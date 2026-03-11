// ============================================================
//  RiskShield — Central Configuration
//  All env vars are read here and exported as typed constants.
//  Components import from here, never from import.meta.env directly.
// ============================================================

// ─────────────────────────────────────────────────────────────
//  ★  AWS TOGGLE  ★
//
//  Set USE_AWS = true  →  S3 storage, DynamoDB sessions,
//                          Lambda pipeline, CloudWatch logs
//  Set USE_AWS = false →  Everything runs locally in-browser,
//                          zero AWS dependency (default)
//
//  Controlled by VITE_USE_AWS in .env.local
//  You can also hard-code it here for convenience:
//    export const USE_AWS = true;
// ─────────────────────────────────────────────────────────────
export const USE_AWS = import.meta.env.VITE_USE_AWS === "true";

// ─────────────────────────────────────────────────────────────
//  Gemini (always used — both modes)
// ─────────────────────────────────────────────────────────────
export const GEMINI = {
  apiKey:      import.meta.env.VITE_GEMINI_API_KEY ?? "",
  model:       import.meta.env.VITE_GEMINI_MODEL   ?? "gemini-2.5-flash-preview-04-17",
  // maxOutputTokens is hardcoded to 65536 (max) in geminiClient.js
  // to prevent JSON truncation on large risk arrays. Do not lower this.
  temperature: Number(import.meta.env.VITE_GEMINI_TEMPERATURE ?? 0.15),
  baseUrl:     "https://generativelanguage.googleapis.com/v1beta/models",
};

// ─────────────────────────────────────────────────────────────
//  RAG (always used — both modes)
// ─────────────────────────────────────────────────────────────
export const RAG = {
  chunkSize:    Number(import.meta.env.VITE_RAG_CHUNK_SIZE    ?? 500),
  chunkOverlap: Number(import.meta.env.VITE_RAG_CHUNK_OVERLAP ?? 60),
  topK:         Number(import.meta.env.VITE_RAG_TOP_K         ?? 7),
};

// ─────────────────────────────────────────────────────────────
//  Agent timing (always used — both modes)
// ─────────────────────────────────────────────────────────────
export const AGENT_TIMING = {
  policyStagger:     Number(import.meta.env.VITE_AGENT_STAGGER_POLICY_MS     ?? 1200),
  mitigationStagger: Number(import.meta.env.VITE_AGENT_STAGGER_MITIGATION_MS ?? 2400),
  summaryDelay:      Number(import.meta.env.VITE_AGENT_SUMMARY_DELAY_MS      ?? 1000),
};

// ─────────────────────────────────────────────────────────────
//  AWS (only used when USE_AWS = true)
//
//  Free-tier services used:
//    S3         — 5 GB storage, 20K GET, 2K PUT/mo
//    DynamoDB   — 25 GB, 25 WCU/RCU/mo
//    Lambda     — 1M requests, 400K GB-sec/mo
//    CloudWatch — 5 GB logs/mo
//
//  Credentials NEVER go in the browser.
//  The frontend only calls the Lambda Function URL (public HTTPS).
//  Lambda itself holds the IAM role with S3/DynamoDB/CloudWatch access.
// ─────────────────────────────────────────────────────────────
export const AWS = {
  // Lambda Function URL — no API Gateway needed (free)
  // e.g. https://abc123.lambda-url.us-east-1.on.aws
  lambdaUrl:  import.meta.env.VITE_AWS_LAMBDA_URL  ?? "",

  // S3 bucket name (Lambda writes to this, frontend gets presigned URLs back)
  s3Bucket:   import.meta.env.VITE_AWS_S3_BUCKET   ?? "riskshield-reports",

  // DynamoDB table name for session + chat history persistence
  dynamoTable: import.meta.env.VITE_AWS_DYNAMO_TABLE ?? "riskshield-sessions",

  // AWS region (used only for display/logging — actual region is in Lambda env)
  region:     import.meta.env.VITE_AWS_REGION       ?? "us-east-1",
};

// ─────────────────────────────────────────────────────────────
//  App metadata
// ─────────────────────────────────────────────────────────────
export const APP = {
  name:    import.meta.env.VITE_APP_NAME    ?? "RiskShield",
  version: import.meta.env.VITE_APP_VERSION ?? "1.0.0",
};
