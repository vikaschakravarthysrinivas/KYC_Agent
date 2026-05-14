# KYC agent

Single-block applicant intake with **structured KYC output** and a **28-row synthetic internal registry** for demo verification. Includes a **web form** (Purple Fabric–style UI) and a CLI.

## Prerequisites

- Node.js 22+
- LiteLLM (or OpenAI-compatible) URL + key in `.env`

## Setup

```bash
npm install
cp .env.example .env
# Edit .env: LITELLM_API_KEY, LITELLM_BASE_URL, KYC_MODEL
```

## Web UI (form → KYC → recommendation)

**Development** (API on port **3040**, Vite on **5173** with `/api` proxy):

```bash
npm run dev
```

Open **http://127.0.0.1:5173** , fill the form, click **Run KYC assessment**. After the structured sections, the **Reviewer workspace** appears: AI-guided summary, optional **Ask the analyst** Q&A thread, and **Approve / Reject / Refer** with notes and **Confirm final disposition** (logged on the server in demo mode).

**Production-style** (single port after building the client):

```bash
npm run build:web
npm run server
```

Open **http://127.0.0.1:3040** — Express serves `dist/web` and these JSON routes:

- `POST /api/kyc` — form body → `{ ok, report, applicantPayload }`
- `POST /api/reviewer-qa` — `{ applicantPayload, report, priorExchanges?, question }` → `{ ok, answer }`
- `POST /api/reviewer-decision` — `{ applicantPayload, report, aiRecommendation?, finalDecision, notes? }` → `{ ok, recorded }` (also `console.log` on the server for demo audit)

## CLI (one payload)

```bash
npm start -- "Name: Vikram Sarabhai, DOB: 1890-01-01, Address: 123 Main St, City: Chennai, State: Tamil Nadu, Pin: 600017, Country: India"
```

Or pipe:

```bash
echo 'Name: Ananya Krishnan, DOB: 1992-04-17, …' | npm start
```

From a TTY with no args, you get one `>` prompt to paste a single line.

## Output

The model returns a **structured report** covering:

1. Applicant profile and onboarding context  
2. Missing, conflicting, or suspicious information  
3. Policy and regulatory evaluation (high level)  
4. Recommendation: `approve` | `reject` | `refer_manual_review`  
5. Justification with evidence (submission + `registry_lookup` tool results)  
6. Reviewer briefing (`whatWasFound`, `whatIsMissing`, `policyOrRuleTriggers`)

After the JSON (CLI only), an **optional reviewer Q&A** loop runs on TTYs (same tagged-context analyst as the web UI).

## Registry

Synthetic records live in `src/data/sampleRegistry.ts` (28 rows). Each row includes **nationality**, **address line 1 + 2**, **city**, **state**, **postal code**, **country**, **ID document type**, **synthetic ID proof reference**, **email**, **phone**, plus risk flags and status. The `registry_lookup` tool returns top matches, discrepancies, and an **`onFileSnapshot`** for those fields. Values are fictional—use only for testing.

## Port already in use (`EADDRINUSE`)

If **`npm run server`** fails on port **3040**, something else is bound there (often a previous **`npm run dev`** or **`npm run server`**). Stop that terminal (Ctrl+C) or pick another port:

```bash
PORT=3041 npm run server
```

On macOS you can see what holds the port: `lsof -iTCP:3040 -sTCP:LISTEN`

## Customize

- Adjust matching in `lookupRegistry()` in `src/data/sampleRegistry.ts`.
- Tune policy text in `src/kycEngine.ts` (`kycStructuredAgent` instructions).
- `KYC_MAX_TURNS` (default `40`) caps internal steps per run.
- `PORT` (default `3040`) for the Express API server.
