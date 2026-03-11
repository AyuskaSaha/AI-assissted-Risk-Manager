// ============================================================
//  RiskShield — Multi-Agent Pipeline Orchestrator
//
//  Agent execution order:
//  1. DocParserAgent    (no LLM — parallel file reads)
//  2. RAGIndexerAgent   (no LLM — TF-IDF index build)
//  3. RiskAnalystAgent  (LLM — sequential, others depend on it)
//  4. PolicyAgent    ┐  (LLM — truly parallel, staggered)
//  5. MitigationAgent┘  (LLM — truly parallel, staggered)
//  6. SummaryAgent      (LLM — sequential, needs merged output)
//
//  When USE_AWS = true (src/config.js):
//   • Raw doc text  → S3  raw-docs/{sessionId}/
//   • Risk report   → S3  reports/{sessionId}/report.json  + presigned URL
//   • Session meta  → DynamoDB  (riskCount, score, s3Key)
//   • Agent logs    → CloudWatch  /riskshield/pipeline/{sessionId}
//
//  When USE_AWS = false (default):
//   • Everything runs locally in-browser, no AWS dependency
// ============================================================

import { callGemini, sleep }                                   from "./geminiClient.js";
import { RISK_SYS, POLICY_SYS, MITIGATION_SYS, SUMMARY_SYS }  from "./prompts.js";
import { buildIndex, retrieve, chunkText }                     from "../utils/rag.js";
import { fileToText }                                          from "../utils/fileParser.js";
import { AGENT_TIMING, USE_AWS }                               from "../config.js";
import {
  s3UploadDocument,
  s3SaveReport,
  dynamoPutSession,
  cloudwatchFlushLogs,
  generateSessionId,
} from "../aws/awsService.js";

// ── Safe word/char trimmers ────────────────────────────────
const trimWords = (text, maxWords) =>
  text.split(/\s+/).slice(0, maxWords).join(" ");

const trimChars = (text, maxChars) =>
  text.length > maxChars ? text.slice(0, maxChars) + "…" : text;

/**
 * Run the full risk analysis pipeline.
 *
 * @param {object}    params
 * @param {string}    params.apiKey
 * @param {File|null} params.srsFile
 * @param {File|null} params.brdFile
 * @param {File|null} params.policyFile
 * @param {function}  params.onLog      - (agent, msg, type) => void
 * @param {function}  params.onProgress - (pct: number) => void
 * @param {function}  params.onStage    - (label: string) => void
 *
 * @returns {{ risks, summary, ragIndex, sessionId, reportUrl }}
 */
export async function runPipeline({ apiKey, srsFile, brdFile, policyFile, onLog, onProgress, onStage }) {
  const log = (agent, msg, type = "info") => onLog?.(agent, msg, type);

  // ── Session ID (used by AWS layer; harmless when AWS is off) ──
  const sessionId = generateSessionId();
  const logBuffer = [];   // accumulate logs for CloudWatch batch flush

  const logAndBuffer = (agent, msg, type = "info") => {
    log(agent, msg, type);
    logBuffer.push({ agent, msg, type, ts: Date.now() });
  };

  if (USE_AWS) {
    logAndBuffer("aws", `☁  AWS mode ON — session ${sessionId}`, "info");
  }

  // ── AGENT 1: Document Parser ─────────────────────────────
  logAndBuffer("doc", "Starting document ingestion...", "active");
  onStage("Parsing documents…");
  onProgress(8);

  const [srsText, brdText, policyText] = await Promise.all([
    srsFile    ? fileToText(srsFile)    : Promise.resolve(""),
    brdFile    ? fileToText(brdFile)    : Promise.resolve(""),
    policyFile ? fileToText(policyFile) : Promise.resolve(""),
  ]);

  const combined = [srsText, brdText].filter(Boolean).join("\n\n");
  logAndBuffer("doc", `Parsed ${combined.length.toLocaleString()} chars from ${[srsFile, brdFile].filter(Boolean).length} doc(s)`, "success");
  onProgress(18);

  // ── AWS: Upload raw docs to S3 ───────────────────────────
  if (USE_AWS) {
    onStage("Uploading documents to S3…");
    try {
      await Promise.all([
        srsText    && s3UploadDocument(sessionId, "srs.txt",    srsText),
        brdText    && s3UploadDocument(sessionId, "brd.txt",    brdText),
        policyText && s3UploadDocument(sessionId, "policy.txt", policyText),
      ].filter(Boolean));
      logAndBuffer("aws", `☁  Docs uploaded → s3://${sessionId}/`, "success");
    } catch (e) {
      logAndBuffer("aws", `⚠ S3 upload failed: ${e.message} (continuing locally)`, "error");
    }
  }

  // ── AGENT 2: RAG Indexer ─────────────────────────────────
  logAndBuffer("rag", "Building TF-IDF index…", "active");
  onStage("Building RAG index…");
  onProgress(25);

  const chunks   = chunkText(combined + "\n\n" + policyText);
  const ragIndex = buildIndex(chunks);
  logAndBuffer("rag", `Indexed ${chunks.length} chunks (${ragIndex.N} total)`, "success");
  onProgress(35);

  // ── AGENT 3: Risk Analyst ────────────────────────────────
  logAndBuffer("risk", "Starting risk analysis…", "active");
  onStage("Risk Analyst Agent running…");
  onProgress(42);

  const riskRagCtx = trimWords(
    retrieve(ragIndex, "security compliance authentication data privacy risks requirements gaps vulnerabilities", 6),
    2000
  );
  const docSummary = trimChars(combined, 1500);

  const riskPrompt =
    `DOCUMENT EXCERPTS (via RAG):\n${riskRagCtx}\n\n` +
    `DOCUMENT SUMMARY (first 1500 chars):\n${docSummary}`;

  logAndBuffer("risk", `Prompt size: ~${Math.round(riskPrompt.length / 4)} tokens`, "info");

  let rawRisks = [];
  try {
    rawRisks = await callGemini(apiKey, RISK_SYS, riskPrompt, true);
    if (!Array.isArray(rawRisks)) throw new Error("Response is not an array");
    logAndBuffer("risk", `✓ Found ${rawRisks.length} risks`, "success");
  } catch (e) {
    logAndBuffer("risk", `✗ ${e.message}`, "error");
    rawRisks = [];
  }
  onProgress(58);

  if (rawRisks.length === 0) {
    logAndBuffer("risk", "No risks parsed — pipeline will continue with fallback data", "error");
  }

  // ── AGENTS 4 + 5: Policy & Mitigation (parallel) ─────────
  logAndBuffer("pol", "Policy check starting (parallel)…", "active");
  logAndBuffer("mit", "Mitigation planning starting (parallel)…", "active");
  onStage("Policy & Mitigation agents running in parallel…");

  const polCtx  = trimWords(
    retrieve(ragIndex, "company policy guidelines rules regulations compliance standards", 5),
    1000
  );
  const mitiCtx = trimWords(
    retrieve(ragIndex, "risk mitigation action plan owner responsibility deadline remediation", 4),
    800
  );

  const risksForPolicy     = rawRisks.map(({ id, title, category, severity, description }) =>
    ({ id, title, category, severity, description }));
  const risksForMitigation = rawRisks.map(({ id, title, severity, likelihood, impact }) =>
    ({ id, title, severity, likelihood, impact }));

  const polInput  = trimChars(JSON.stringify(risksForPolicy),     3000);
  const mitiInput = trimChars(JSON.stringify(risksForMitigation), 3000);

  const [policyResults, mitigationResults] = await Promise.all([

    (async () => {
      try {
        await sleep(AGENT_TIMING.policyStagger);
        const res = await callGemini(
          apiKey,
          POLICY_SYS,
          `RISKS:\n${polInput}\n\nPOLICY CONTEXT:\n${polCtx}`,
          true
        );
        const arr = Array.isArray(res) ? res : [];
        logAndBuffer("pol", `✓ Policy check complete (${arr.length} results)`, "success");
        return arr;
      } catch (e) {
        logAndBuffer("pol", `✗ ${e.message}`, "error");
        return [];
      }
    })(),

    (async () => {
      try {
        await sleep(AGENT_TIMING.mitigationStagger);
        const res = await callGemini(
          apiKey,
          MITIGATION_SYS,
          `RISKS:\n${mitiInput}`,
          true
        );
        const arr = Array.isArray(res) ? res : [];
        logAndBuffer("mit", `✓ Mitigation strategies generated (${arr.length} results)`, "success");
        return arr;
      } catch (e) {
        logAndBuffer("mit", `✗ ${e.message}`, "error");
        return [];
      }
    })(),
  ]);
  onProgress(82);

  // ── Merge all agent outputs ───────────────────────────────
  const policyMap     = Object.fromEntries(policyResults.map((p) => [p.id, p]));
  const mitigationMap = Object.fromEntries(mitigationResults.map((m) => [m.id, m]));

  const mergedRisks = rawRisks.map((r) => ({
    ...r,
    ...(policyMap[r.id]     || {}),
    ...(mitigationMap[r.id] || {}),
  }));

  // ── AGENT 6: Summary Generator ───────────────────────────
  logAndBuffer("sum", "Generating executive summary…", "active");
  onStage("Generating executive summary…");
  onProgress(90);

  const summaryInput = mergedRisks.map(({ id, title, severity, likelihood, impact, policy_status }) =>
    ({ id, title, severity, likelihood, impact, policy_status }));

  let summary = null;
  try {
    await sleep(AGENT_TIMING.summaryDelay);
    summary = await callGemini(
      apiKey,
      SUMMARY_SYS,
      `RISK LIST:\n${JSON.stringify(summaryInput)}`,
      true
    );
    logAndBuffer("sum", "✓ Summary complete", "success");
  } catch (e) {
    logAndBuffer("sum", `✗ ${e.message} — using computed fallback`, "error");
    summary = buildFallbackSummary(mergedRisks);
  }

  // ── AWS: Save report + session + flush logs ───────────────
  let reportUrl = null;

  if (USE_AWS) {
    onStage("Saving report to AWS…");
    try {
      // S3 — save full report JSON + get presigned download URL
      const saved = await s3SaveReport(sessionId, { risks: mergedRisks, summary });
      reportUrl = saved?.presignedUrl ?? null;
      if (reportUrl) logAndBuffer("aws", `☁  Report saved → ${saved.s3Key}`, "success");

      // DynamoDB — persist session metadata
      await dynamoPutSession(sessionId, {
        riskCount:    mergedRisks.length,
        overallScore: summary?.overall_score ?? 0,
        s3ReportKey:  saved?.s3Key ?? "",
      });
      logAndBuffer("aws", `☁  Session ${sessionId} persisted to DynamoDB`, "success");
    } catch (e) {
      logAndBuffer("aws", `⚠ AWS save failed: ${e.message}`, "error");
    }

    // CloudWatch — flush all buffered logs in one batch
    try {
      await cloudwatchFlushLogs(sessionId, logBuffer);
      logAndBuffer("aws", `☁  ${logBuffer.length} log events → CloudWatch`, "success");
    } catch (e) {
      // Non-fatal — just log locally
      console.warn("[CW] Log flush failed:", e.message);
    }
  }

  onProgress(100);
  onStage("Analysis complete!");

  return { risks: mergedRisks, summary, ragIndex, sessionId, reportUrl };
}

// ── Fallback summary when Gemini call fails ────────────────
function buildFallbackSummary(risks) {
  const critical = risks.filter((r) => r.severity === "Critical").length;
  const high     = risks.filter((r) => r.severity === "High").length;
  const score    = Math.min(100, critical * 20 + high * 10 + risks.length * 2);
  const top      = [...risks].sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact)[0];
  return {
    headline:       `Analysis found ${risks.length} risks — ${critical} critical, ${high} high severity.`,
    overall_score:  score,
    critical_count: critical,
    high_count:     high,
    top_priority:   top ? `${top.id}: ${top.title}` : "–",
    recommendation: "Prioritize critical and high severity risks before proceeding to development. Assign owners and remediation timelines immediately.",
    trend:          critical > 2 ? "Deteriorating" : critical > 0 ? "Stable" : "Improving",
  };
}
