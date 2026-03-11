// ============================================================
//  RiskShield — AWS Lambda Handler
//  Node.js 20.x  |  Deploy with Function URL enabled (free)
//
//  This Lambda handles ALL AWS SDK operations so the browser
//  never needs credentials. Attach an IAM role with these
//  managed policies (all free-tier compatible):
//    • AmazonS3FullAccess          (or a scoped custom policy)
//    • AmazonDynamoDBFullAccess    (or a scoped custom policy)
//    • CloudWatchLogsFullAccess
//
//  Environment variables to set in Lambda console:
//    S3_BUCKET      — your S3 bucket name
//    DYNAMO_TABLE   — your DynamoDB table name
//    ALLOWED_ORIGIN — your frontend domain (for CORS)
//
//  Lambda settings (free tier):
//    Runtime:  Node.js 20.x
//    Memory:   256 MB
//    Timeout:  30 seconds
//    Arch:     x86_64
//
//  Function URL settings:
//    Auth type: NONE  (public endpoint — frontend calls this)
//    CORS:      enabled  (set Allowed Origins to your domain)
// ============================================================

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  PutLogEventsCommand,
  DescribeLogStreamsCommand,
} from "@aws-sdk/client-cloudwatch-logs";

// ── AWS Clients (region from Lambda execution environment) ──
const REGION  = process.env.AWS_REGION || "us-east-1";
const BUCKET  = process.env.S3_BUCKET  || "riskshield-reports";
const TABLE   = process.env.DYNAMO_TABLE || "riskshield-sessions";
const ORIGIN  = process.env.ALLOWED_ORIGIN || "*";
const LOG_GROUP = "/riskshield/pipeline";

const s3      = new S3Client({ region: REGION });
const dynamo  = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const cwLogs  = new CloudWatchLogsClient({ region: REGION });

// ── CORS headers for Function URL ───────────────────────────
const CORS = {
  "Access-Control-Allow-Origin":  ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const ok  = (body) => ({ statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const err = (msg, code = 500) => ({ statusCode: code, headers: CORS, body: JSON.stringify({ error: msg }) });

// ── TTL: 30 days from now ────────────────────────────────────
const ttl30d = () => Math.floor(Date.now() / 1000) + 30 * 24 * 3600;

// ════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ════════════════════════════════════════════════════════════
export const handler = async (event) => {
  // Handle CORS preflight
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return err("Invalid JSON body", 400);
  }

  const { action } = body;
  if (!action) return err("Missing 'action' field", 400);

  try {
    switch (action) {
      // ── S3 ────────────────────────────────────────────────
      case "s3_upload_document":   return ok(await s3UploadDocument(body));
      case "s3_save_report":       return ok(await s3SaveReport(body));
      case "s3_load_report":       return ok(await s3LoadReport(body));

      // ── DynamoDB ─────────────────────────────────────────
      case "dynamo_put_session":   return ok(await dynamoPutSession(body));
      case "dynamo_get_session":   return ok(await dynamoGetSession(body));
      case "dynamo_list_sessions": return ok(await dynamoListSessions(body));
      case "dynamo_save_chat":     return ok(await dynamoSaveChat(body));
      case "dynamo_load_chat":     return ok(await dynamoLoadChat(body));

      // ── CloudWatch ───────────────────────────────────────
      case "cw_flush_logs":        return ok(await cwFlushLogs(body));

      default:
        return err(`Unknown action: ${action}`, 400);
    }
  } catch (e) {
    console.error(`[${action}] Error:`, e);
    return err(e.message);
  }
};

// ════════════════════════════════════════════════════════════
//  S3 HANDLERS
// ════════════════════════════════════════════════════════════

async function s3UploadDocument({ sessionId, filename, content, bucket = BUCKET }) {
  const key = `raw-docs/${sessionId}/${filename}`;
  await s3.send(new PutObjectCommand({
    Bucket:      bucket,
    Key:         key,
    Body:        content,
    ContentType: "text/plain",
  }));
  console.log(`[S3] Uploaded ${key} (${content.length} chars)`);
  return { s3Key: key };
}

async function s3SaveReport({ sessionId, report, bucket = BUCKET }) {
  const key = `reports/${sessionId}/report.json`;
  await s3.send(new PutObjectCommand({
    Bucket:      bucket,
    Key:         key,
    Body:        JSON.stringify(report, null, 2),
    ContentType: "application/json",
  }));

  // Generate a presigned URL valid for 1 hour
  const presignedUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 3600 }
  );

  console.log(`[S3] Saved report ${key}`);
  return { s3Key: key, presignedUrl };
}

async function s3LoadReport({ sessionId, bucket = BUCKET }) {
  const key = `reports/${sessionId}/report.json`;
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await res.Body.transformToString();
  return JSON.parse(body);
}

// ════════════════════════════════════════════════════════════
//  DYNAMODB HANDLERS
// ════════════════════════════════════════════════════════════

async function dynamoPutSession({ sessionId, meta, table = TABLE }) {
  await dynamo.send(new PutCommand({
    TableName: table,
    Item: {
      PK:          sessionId,
      SK:          "META",
      createdAt:   new Date().toISOString(),
      riskCount:   meta.riskCount   ?? 0,
      overallScore: meta.overallScore ?? 0,
      s3ReportKey: meta.s3ReportKey  ?? "",
      ttl:         ttl30d(),
    },
  }));
  console.log(`[DDB] Session ${sessionId} saved`);
  return { sessionId };
}

async function dynamoGetSession({ sessionId, table = TABLE }) {
  const res = await dynamo.send(new GetCommand({
    TableName: table,
    Key: { PK: sessionId, SK: "META" },
  }));
  return res.Item ?? null;
}

async function dynamoListSessions({ table = TABLE }) {
  // Note: For production, use a GSI on createdAt.
  // For free-tier dev, a small Scan is fine (< 25 RCU limit).
  const { Items = [] } = await dynamo.send(new QueryCommand({
    TableName:              table,
    KeyConditionExpression: "SK = :sk",
    ExpressionAttributeValues: { ":sk": "META" },
    IndexName:              "SK-index",  // create this GSI in DynamoDB console
    Limit:                  10,
    ScanIndexForward:       false,
  }));
  return Items;
}

async function dynamoSaveChat({ sessionId, role, text, table = TABLE }) {
  const ts = Date.now();
  await dynamo.send(new PutCommand({
    TableName: table,
    Item: {
      PK:        sessionId,
      SK:        `CHAT#${ts}`,
      role,
      text,
      timestamp: new Date(ts).toISOString(),
      ttl:       ttl30d(),
    },
  }));
  return { saved: true };
}

async function dynamoLoadChat({ sessionId, table = TABLE }) {
  const { Items = [] } = await dynamo.send(new QueryCommand({
    TableName:              table,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk":     sessionId,
      ":prefix": "CHAT#",
    },
    ScanIndexForward: true,  // chronological order
  }));
  return Items.map(({ role, text, timestamp }) => ({ role, text, timestamp }));
}

// ════════════════════════════════════════════════════════════
//  CLOUDWATCH LOGS HANDLER
// ════════════════════════════════════════════════════════════

async function cwFlushLogs({ sessionId, logEntries, logGroup = LOG_GROUP, logStream }) {
  const stream = logStream || sessionId;

  // Ensure log group exists
  try {
    await cwLogs.send(new CreateLogGroupCommand({ logGroupName: logGroup }));
  } catch (e) {
    if (e.name !== "ResourceAlreadyExistsException") throw e;
  }

  // Ensure log stream exists
  try {
    await cwLogs.send(new CreateLogStreamCommand({
      logGroupName:  logGroup,
      logStreamName: stream,
    }));
  } catch (e) {
    if (e.name !== "ResourceAlreadyExistsException") throw e;
  }

  // Get sequence token if stream already has events
  let sequenceToken;
  try {
    const desc = await cwLogs.send(new DescribeLogStreamsCommand({
      logGroupName:        logGroup,
      logStreamNamePrefix: stream,
    }));
    sequenceToken = desc.logStreams?.[0]?.uploadSequenceToken;
  } catch (_) { /* ignore */ }

  // Put log events
  const events = logEntries.map((l) => ({
    timestamp: l.ts || Date.now(),
    message:   `[${l.agent?.toUpperCase() ?? "SYS"}] [${l.type?.toUpperCase() ?? "INFO"}] ${l.msg}`,
  }));

  await cwLogs.send(new PutLogEventsCommand({
    logGroupName:  logGroup,
    logStreamName: stream,
    logEvents:     events,
    ...(sequenceToken ? { sequenceToken } : {}),
  }));

  console.log(`[CW] Flushed ${events.length} log events for session ${sessionId}`);
  return { flushed: events.length };
}
