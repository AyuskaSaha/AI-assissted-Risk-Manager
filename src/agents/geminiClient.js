// ============================================================
//  RiskShield — Gemini API Client
//  Wraps fetch calls to Gemini with retry + rate-limit handling.
//  Free tier: 10 RPM · 250 RPD · 1M TPM
// ============================================================

import { GEMINI } from "../config.js";

/**
 * Call Gemini with a system prompt + user message.
 * @param {string}  apiKey       - Gemini API key (from user input or env)
 * @param {string}  systemPrompt
 * @param {string}  userPrompt
 * @param {boolean} expectJson   - If true, parse response as JSON with repair
 * @returns {Promise<string|object>}
 */
export async function callGemini(apiKey, systemPrompt, userPrompt, expectJson = false) {
  const key = apiKey || GEMINI.apiKey;
  if (!key) throw new Error("No Gemini API key provided. Set VITE_GEMINI_API_KEY in .env.local");

  const url = `${GEMINI.baseUrl}/${GEMINI.model}:generateContent?key=${key}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature:     GEMINI.temperature,
      // 65 536 is the max output Gemini 2.5 Flash supports —
      // large enough for a full risk-register JSON array.
      maxOutputTokens: 65536,
      ...(expectJson ? { responseMimeType: "application/json" } : {}),
    },
  };

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });

    // Rate-limited → exponential back-off
    if (res.status === 429) {
      const waitMs = 9000 * (attempt + 1);
      console.warn(`[Gemini] 429 — waiting ${waitMs}ms (attempt ${attempt + 1})`);
      await sleep(waitMs);
      continue;
    }

    const data = await res.json();
    if (data.error) throw new Error(`Gemini API error: ${data.error.message}`);

    // Check finish reason — RECITATION / SAFETY can also truncate
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== "STOP" && finishReason !== "MAX_TOKENS") {
      console.warn(`[Gemini] Unexpected finishReason: ${finishReason}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (expectJson) {
      return repairAndParseJSON(text);
    }

    return text;
  }

  throw new Error("Gemini rate limit exceeded after 4 retries");
}

// ─────────────────────────────────────────────────────────────
//  JSON repair pipeline
//  Handles the four common failure modes from Gemini:
//   1. Wrapped in ```json … ``` fences
//   2. Truncated mid-string  (most common with large arrays)
//   3. Trailing comma before closing bracket
//   4. Response is a JSON object when we expected an array
// ─────────────────────────────────────────────────────────────
function repairAndParseJSON(raw) {
  // Step 1 — strip markdown fences and leading/trailing whitespace
  let text = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // Step 2 — try clean parse first (happy path)
  try {
    return JSON.parse(text);
  } catch (_) { /* fall through to repair */ }

  // Step 3 — extract the outermost JSON structure
  //           handles cases where Gemini prepends a sentence
  const arrayStart  = text.indexOf("[");
  const objectStart = text.indexOf("{");

  if (arrayStart !== -1 && (objectStart === -1 || arrayStart < objectStart)) {
    text = text.slice(arrayStart);
  } else if (objectStart !== -1) {
    text = text.slice(objectStart);
  }

  // Step 4 — try after extraction
  try {
    return JSON.parse(text);
  } catch (_) { /* fall through */ }

  // Step 5 — repair truncated JSON
  //  Strategy: find the last COMPLETE object in an array
  //  by scanning backwards for `}` and trying to close the array there.
  text = repairTruncatedArray(text);

  try {
    return JSON.parse(text);
  } catch (_) { /* fall through */ }

  // Step 6 — strip trailing commas (e.g. `[{...},]`)
  text = text.replace(/,\s*([\]}])/g, "$1");
  try {
    return JSON.parse(text);
  } catch (_) { /* fall through */ }

  // Step 7 — last resort: extract individual complete objects with regex
  const objects = extractCompleteObjects(text);
  if (objects.length > 0) {
    console.warn(`[Gemini] Partial JSON recovered — got ${objects.length} objects via regex`);
    return objects;
  }

  // Nothing worked
  throw new Error(`Could not parse Gemini JSON response. Raw (first 300 chars): ${raw.slice(0, 300)}`);
}

/**
 * Given a truncated JSON array string, find the last complete `}` 
 * and close the array cleanly.
 */
function repairTruncatedArray(text) {
  // Remove everything after the last `}` and close the array
  const lastBrace = text.lastIndexOf("}");
  if (lastBrace === -1) return text;

  let repaired = text.slice(0, lastBrace + 1);

  // Make sure it starts as an array
  if (!repaired.trimStart().startsWith("[")) {
    repaired = "[" + repaired;
  }

  // Close the array if not already closed
  const trimmed = repaired.trimEnd();
  if (!trimmed.endsWith("]")) {
    repaired = trimmed + "]";
  }

  // Remove trailing comma before the closing bracket
  repaired = repaired.replace(/,\s*]$/, "]");

  return repaired;
}

/**
 * Extract all complete `{ … }` objects from a broken JSON string
 * using a brace-counting approach (handles nested objects).
 */
function extractCompleteObjects(text) {
  const results = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        const fragment = text.slice(start, i + 1);
        try {
          results.push(JSON.parse(fragment));
        } catch (_) {
          // skip unparseable fragments
        }
        start = -1;
      }
    }
  }

  return results;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
