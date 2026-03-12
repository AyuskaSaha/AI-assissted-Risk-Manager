# RiskShield — AI-Powered Risk Management System

> Analyze SRS & BRD documents with 6 parallel AI agents, full visualization dashboard, and an interactive Copilot. **100% free. No backend. No data leaves your browser.**

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18 + Recharts |
| AI | Gemini 2.5 Flash (Google AI Studio — free) |
| RAG | In-memory TF-IDF (browser-native, zero cost) |
| Build | Vite 5 |
| Hosting | Any static host (Vercel, Netlify, GitHub Pages) |

---

## Project Structure

```
riskshield/
├── .env                          # Default env vars (safe to commit)
├── .env.local                    # Your secrets — DO NOT COMMIT
├── .env.example                  # Template for new contributors
├── .gitignore
├── package.json
├── vite.config.js
├── index.html
│
└── src/
    ├── main.jsx                  # React entry point
    ├── App.jsx                   # Root component / screen router
    ├── config.js                 # Central config (reads .env)
    │
    ├── styles/
    │   ├── global.css            # Global resets + keyframes
    │   └── tokens.js             # Design tokens (colors, fonts)
    │
    ├── agents/
    │   ├── geminiClient.js       # Gemini API wrapper + retry logic
    │   ├── prompts.js            # All LLM system prompts
    │   └── pipeline.js           # Multi-agent orchestration
    │
    ├── utils/
    │   ├── rag.js                # TF-IDF RAG engine
    │   └── fileParser.js         # File → text extraction
    │
    ├── hooks/
    │   └── usePipeline.js        # React hook for pipeline state
    │
    ├── components/
    │   ├── ui/
    │   │   └── Atoms.jsx         # Shared UI primitives
    │   └── dashboard/
    │       ├── DashboardVisuals.jsx   # 9 charts + executive summary
    │       ├── RiskTable.jsx          # Filterable risk register
    │       └── Copilot.jsx            # Conversational AI assistant
    │
    └── views/
        ├── UploadView.jsx        # Landing + document upload
        ├── AnalysisView.jsx      # Live pipeline progress
        └── DashboardView.jsx     # Tabbed dashboard container
```

---

## Quick Start

### 1. Get a Free Gemini API Key
Go to [aistudio.google.com](https://aistudio.google.com) → Create API Key → Copy it.

Free tier: **10 RPM · 250 RPD · 1M TPM** — more than enough.

### 2. Clone & Install

```bash
git clone https://github.com/your-org/riskshield.git
cd riskshield
npm install
```

### 3. Set Environment Variables

```bash
cp .env.example .env.local
# Edit .env.local and paste your Gemini API key
```

```env
VITE_GEMINI_API_KEY=AIzaSy...your_key_here
```

### 4. Run

```bash
npm run dev
# Opens at http://localhost:3000
```

---

## Agent Pipeline

```
Upload → DocParser → RAGIndexer → RiskAnalyst
                                       ↓
                           ┌─── PolicyAgent (parallel) ───┐
                           └─── MitigationAgent (parallel) ┘
                                       ↓
                               SummaryGenerator → Dashboard
```

| Agent | LLM? | Runs | Purpose |
|---|---|---|---|
| DocParser | ✗ | Parallel | Extract text from SRS/BRD/Policy files |
| RAGIndexer | ✗ | Sequential | Build TF-IDF vector index |
| RiskAnalyst | ✓ | Sequential | Identify risks across 6 dimensions |
| PolicyAgent | ✓ | **Parallel** | Validate risks against company policy |
| MitigationAgent | ✓ | **Parallel** | Generate mitigation strategies |
| SummaryAgent | ✓ | Sequential | Generate executive summary |

Peak concurrent LLM calls: **2** → well within 10 RPM free limit.

---

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `VITE_GEMINI_API_KEY` | *(required)* | Your Google AI Studio API key |
| `VITE_GEMINI_MODEL` | `gemini-2.5-flash-preview-04-17` | Gemini model to use |
| `VITE_GEMINI_MAX_TOKENS` | `8192` | Max tokens per response |
| `VITE_GEMINI_TEMPERATURE` | `0.15` | Lower = more deterministic |
| `VITE_RAG_CHUNK_SIZE` | `500` | Words per document chunk |
| `VITE_RAG_CHUNK_OVERLAP` | `60` | Overlap between chunks |
| `VITE_RAG_TOP_K` | `7` | Top-K chunks to retrieve |
| `VITE_AGENT_STAGGER_POLICY_MS` | `1200` | Delay before policy agent (ms) |
| `VITE_AGENT_STAGGER_MITIGATION_MS` | `2400` | Delay before mitigation agent (ms) |
| `VITE_AGENT_SUMMARY_DELAY_MS` | `1000` | Delay before summary agent (ms) |

---

## AWS Integration (Optional — Free Tier)

RiskShield has a **single boolean toggle** that switches between fully local and cloud-backed mode.

### The toggle

In `src/config.js` (or via `.env.local`):

```js
// Hard-code it directly:
export const USE_AWS = true;   // ← flip this

// Or use env var:
// VITE_USE_AWS=true  in .env.local
```

| `USE_AWS` | Behaviour |
|---|---|
| `false` (default) | 100% local, no AWS needed, works offline |
| `true` | Activates S3, DynamoDB, Lambda, CloudWatch |

### What each AWS service does

| Service | Free tier | Role in RiskShield |
|---|---|---|
| **Lambda** | 1M req/mo · 400K GB-sec | Handles all SDK calls — browser never holds credentials |
| **S3** | 5 GB · 20K GET · 2K PUT/mo | Stores raw docs + risk report JSON with presigned download URL |
| **DynamoDB** | 25 GB · 25 WCU/RCU/mo | Persists sessions (30-day TTL) + full Copilot chat history |
| **CloudWatch** | 5 GB ingestion/mo | Records all 6 agent log events per session |

### Setup (3 steps)

**Step 1 — Deploy AWS resources (one command)**

```bash
aws cloudformation deploy \
  --template-file aws/cloudformation.yaml \
  --stack-name riskshield \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides AllowedOrigin=https://your-domain.com
```

**Step 2 — Upload the Lambda code**

```bash
cd lambda
npm install
zip -r ../lambda.zip .
aws lambda update-function-code \
  --function-name riskshield-pipeline \
  --zip-file fileb://../lambda.zip
```

**Step 3 — Copy CloudFormation outputs to `.env.local`**

```bash
# Get outputs
aws cloudformation describe-stacks --stack-name riskshield \
  --query "Stacks[0].Outputs"

# Then in .env.local:
VITE_USE_AWS=true
VITE_AWS_LAMBDA_URL=https://abc123.lambda-url.us-east-1.on.aws
VITE_AWS_S3_BUCKET=riskshield-reports
VITE_AWS_DYNAMO_TABLE=riskshield-sessions
VITE_AWS_REGION=us-east-1
```

Done. Restart `npm run dev` — the dashboard will show a `☁ RS-XXXX` session badge and a `↓ S3 Report` download button when AWS is active.

### Architecture

```
Browser
  │
  ├─ Gemini API  (direct, always — LLM calls)
  │
  └─ Lambda Function URL  (only when USE_AWS=true)
       │
       ├─ S3          raw-docs/{sessionId}/*.txt
       │              reports/{sessionId}/report.json  → presigned URL
       │
       ├─ DynamoDB    PK=sessionId  SK=META | CHAT#<ts>
       │              TTL = 30 days
       │
       └─ CloudWatch  /riskshield/pipeline/{sessionId}
```

> Credentials **never** touch the browser. The Lambda function URL is the only public endpoint; it holds an IAM role scoped to just our S3 bucket, DynamoDB table, and CloudWatch log group.

---

```bash
npm run build
# Output in /dist — deploy to any static host
```

---

## License

MIT
