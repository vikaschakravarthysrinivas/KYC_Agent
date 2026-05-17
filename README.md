# KYC agent

Single-block applicant intake with **structured KYC output** and a **41-row synthetic internal registry** for demo verification. Includes a **web form** (Purple Fabric–style UI) and a CLI.

## Prerequisites

- Node.js 22+
- LiteLLM (or OpenAI-compatible) URL + key in `.env`

## Setup

```bash
npm install
cp .env.example .env
# Edit .env: LITELLM_API_KEY, LITELLM_BASE_URL, KYC_MODEL
```

### Run the latest code

```bash
# Stop any old server (Ctrl+C), then:
npm install          # after pulling changes
npm run dev          # API :3040 + UI :5173
```

Open **http://127.0.0.1:5173** (not :3040 alone during dev).

**Test ID extraction only** (no full KYC):

```bash
npm run test:id-extract -- /path/to/passport.jpg india_passport
```

**Test face match only** (ID portrait crop + selfie; demo static comparison, not video liveness):

```bash
npm run test:face-match -- /path/to/id-front.jpg /path/to/selfie.jpg india_passport
```

Expect `Done in …ms` and JSON with name / passport number in **under ~30s** on Opus, faster with `KYC_VISION_MODEL=gpt-4o`.

## Web UI (form → KYC → recommendation)

**Development** (recommended — API on port **3040**, Vite on **5173** with `/api` proxy and latest UI):

```bash
npm run dev
```

Open **http://127.0.0.1:5173** (not :3040 alone during dev, unless you ran `build:web` after UI changes).

Open **http://127.0.0.1:5173** , fill the form, optionally upload an **India driving licence, Aadhaar, or passport** (one combined scan or separate front/back), and a **live selfie** when ID is uploaded (required). Then click **Run KYC assessment**. With an ID image, the UI shows extracted fields, **demo face match** (selfie vs portrait cropped from the ID — static photos, not true liveness), and form-vs-ID comparison before the AI assessment. After the structured sections, the **Reviewer workspace** appears: AI-guided summary, optional **Ask the analyst** Q&A thread, and **Approve / Reject / Refer** with notes and **Confirm final disposition** (logged on the server in demo mode).

**Production-style** (single port after building the client):

```bash
npm run build:web
npm run server
```

Open **http://127.0.0.1:3040** — Express serves `dist/web` and these JSON routes:

- `POST /api/kyc` — form body (+ optional `idCard` + required `selfie` when ID present) → `{ ok, report, applicantPayload, idExtraction?, idVerification?, faceMatch?, idFacePreview? }`
- `POST /api/kyc/face-match` — `idCard` + `selfie` only (face crop + compare, no full KYC)
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
5. Justification with evidence (submission + `registry_lookup` + `id_document_verify` + `face_match_verify` when ID and selfie uploaded)  
6. Reviewer briefing (`whatWasFound`, `whatIsMissing`, `policyOrRuleTriggers`)

After the JSON (CLI only), an **optional reviewer Q&A** loop runs on TTYs (same tagged-context analyst as the web UI).

## National ID samples

- Driving licence: [`samples/id-cards/india-dl/README.md`](samples/id-cards/india-dl/README.md)
- Aadhaar: [`samples/id-cards/india-aadhaar/README.md`](samples/id-cards/india-aadhaar/README.md)
- Passport: [`samples/id-cards/india-passport/README.md`](samples/id-cards/india-passport/README.md)

The UI supports **driving licence, Aadhaar, and passport** extraction.

### Speed tips (if ID step hangs or takes minutes)

1. Set **`KYC_VISION_MODEL`** to a **fast vision model** your LiteLLM proxy allows (e.g. `gpt-4o` or `gpt-4o-mini`). If unset, vision uses `KYC_MODEL` (often slow Opus-class models).
2. Large scans are **auto-compressed** before upload (Bedrock limits images to 5 MB).
3. For registry/KYC-only demos when the form already matches the card README, set **`KYC_SKIP_ID_VISION=1`** — skips OCR and finishes in seconds.

See `.env.example` for `KYC_VISION_IMAGE_DETAIL`, `KYC_VISION_MAX_TURNS`, `KYC_SKIP_ID_VISION`, and **`KYC_FACE_MODEL=gpt-4o`** (recommended — face match uses one vision call but is still slow on Opus-class models).

## Registry

Synthetic records live in `src/data/sampleRegistry.ts` (41 rows; REG-029–REG-041 match `samples/id-cards/` test personas). Each row includes **nationality**, **address line 1 + 2**, **city**, **state**, **postal code**, **country**, **ID document type**, **synthetic ID proof reference**, **email**, **phone**, plus risk flags and status. The `registry_lookup` tool returns top matches, discrepancies, and an **`onFileSnapshot`** for those fields. Values are fictional—use only for testing.

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
