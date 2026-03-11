// ============================================================
//  RiskShield — AWS Service Layer
//
//  Architecture:
//    Browser  ──fetch──▶  Lambda Function URL (HTTPS, free)
//    Lambda   ──SDK──▶   S3 | DynamoDB | CloudWatch
//
//  The browser NEVER holds AWS credentials.
//  All SDK calls happen inside Lambda (IAM role attached).
//
//  Free-tier budget per month:
//    Lambda     1 000 000 requests  +  400 000 GB-sec compute
//    S3         5 GB storage        +  20 000 GET  +  2 000 PUT
//    DynamoDB   25 GB               +  25 WCU      +  25 RCU
//    CloudWatch 5 GB log ingestion  +  5 GB archival
//
//  All four services stay well within free tier for normal usage.
// ============================================================

import { AWS, USE_AWS } from "../config.js";

// ─── Internal fetch helper ─────────────────────────────────
async function callLambda(action, payload) {
  if (!USE_AWS) return null;
  if (!AWS.lambdaUrl) {
    console.warn("[AWS] VITE_AWS_LAMBDA_URL not set — skipping AWS call");
    return null;
  }

  const res = await fetch(AWS.lambdaUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ action, ...payload }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Lambda [${action}] failed (${res.status}): ${err}`);
  }

  return res.json();
}

// ════════════════════════════════════════════════════════════
//  S3 — Document & Report Storage
//  Free tier: 5 GB storage, 20K GET, 2K PUT/mo
// ════════════════════════════════════════════════════════════

/**
 * Upload raw document text to S3.
 * Lambda writes: s3://{bucket}/raw-docs/{sessionId}/{filename}
 *
 * @param {string} sessionId
 * @param {string} filename   - e.g. "srs.txt"
 * @param {string} content    - plain text
 * @returns {Promise<{s3Key: string}|null>}
 */
export async function s3UploadDocument(sessionId, filename, content) {
  return callLambda("s3_upload_document", {
    sessionId,
    filename,
    content,
    bucket: AWS.s3Bucket,
  });
}

/**
 * Save the final risk report JSON to S3 and get a presigned URL.
 * Lambda writes: s3://{bucket}/reports/{sessionId}/report.json
 * Returns a presigned GET URL valid for 1 hour.
 *
 * @param {string} sessionId
 * @param {object} report    - { risks, summary }
 * @returns {Promise<{s3Key: string, presignedUrl: string}|null>}
 */
export async function s3SaveReport(sessionId, report) {
  return callLambda("s3_save_report", {
    sessionId,
    report,
    bucket: AWS.s3Bucket,
  });
}

/**
 * Fetch a previously saved report from S3 by session ID.
 *
 * @param {string} sessionId
 * @returns {Promise<{risks: object[], summary: object}|null>}
 */
export async function s3LoadReport(sessionId) {
  return callLambda("s3_load_report", {
    sessionId,
    bucket: AWS.s3Bucket,
  });
}

// ════════════════════════════════════════════════════════════
//  DynamoDB — Session & Chat History Persistence
//  Free tier: 25 GB, 25 WCU, 25 RCU/mo
//
//  Table schema:
//    PK: sessionId (string)
//    SK: "META" | "CHAT#<timestamp>"
//    TTL: 30 days (auto-delete old sessions — free)
// ════════════════════════════════════════════════════════════

/**
 * Create or update a session record in DynamoDB.
 * Stores: sessionId, createdAt, riskCount, overallScore, s3ReportKey
 *
 * @param {string} sessionId
 * @param {object} meta  - { riskCount, overallScore, s3ReportKey }
 * @returns {Promise<{sessionId: string}|null>}
 */
export async function dynamoPutSession(sessionId, meta) {
  return callLambda("dynamo_put_session", {
    sessionId,
    meta,
    table: AWS.dynamoTable,
  });
}

/**
 * Load session metadata from DynamoDB.
 *
 * @param {string} sessionId
 * @returns {Promise<object|null>}
 */
export async function dynamoGetSession(sessionId) {
  return callLambda("dynamo_get_session", {
    sessionId,
    table: AWS.dynamoTable,
  });
}

/**
 * List the 10 most recent sessions (for a "history" feature).
 *
 * @returns {Promise<object[]|null>}
 */
export async function dynamoListSessions() {
  return callLambda("dynamo_list_sessions", {
    table: AWS.dynamoTable,
  });
}

/**
 * Append a copilot chat message to DynamoDB.
 * Each message is a separate item: SK = "CHAT#<timestamp>"
 *
 * @param {string} sessionId
 * @param {"user"|"ai"} role
 * @param {string} text
 * @returns {Promise<null>}
 */
export async function dynamoSaveChatMessage(sessionId, role, text) {
  return callLambda("dynamo_save_chat", {
    sessionId,
    role,
    text,
    table: AWS.dynamoTable,
  });
}

/**
 * Load all chat messages for a session from DynamoDB.
 *
 * @param {string} sessionId
 * @returns {Promise<Array<{role: string, text: string}>|null>}
 */
export async function dynamoLoadChatHistory(sessionId) {
  return callLambda("dynamo_load_chat", {
    sessionId,
    table: AWS.dynamoTable,
  });
}

// ════════════════════════════════════════════════════════════
//  CloudWatch — Agent Activity Logging
//  Free tier: 5 GB log ingestion, 5 GB archival/mo
//
//  Log group:  /riskshield/pipeline
//  Log stream: {sessionId}
// ════════════════════════════════════════════════════════════

/**
 * Flush a batch of agent log entries to CloudWatch.
 * Lambda calls putLogEvents on log group /riskshield/pipeline.
 *
 * @param {string}   sessionId
 * @param {Array<{agent: string, msg: string, type: string, ts: number}>} logEntries
 * @returns {Promise<null>}
 */
export async function cloudwatchFlushLogs(sessionId, logEntries) {
  return callLambda("cw_flush_logs", {
    sessionId,
    logEntries,
    logGroup:  "/riskshield/pipeline",
    logStream: sessionId,
  });
}

// ════════════════════════════════════════════════════════════
//  Utility
// ════════════════════════════════════════════════════════════

/** Generate a short unique session ID (client-side, no AWS needed) */
export function generateSessionId() {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `RS-${ts}-${rand}`;
}
