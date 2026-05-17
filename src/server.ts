import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  kycReportSchema,
  runKycPipeline,
  runKycWithOptionalIdVerification,
  runReviewerQaTurn,
  type KycFormInput,
  type KycStreamEvent,
  type ReviewerExchange,
} from './kycEngine.js';
import {
  extractNationalId,
  isSkipIdVisionEnabled,
  normalizeIdCardUpload,
  nationalIdDocumentTypeLabel,
  runFaceMatch,
} from './idCard/index.js';
import { getFaceModel } from './idCard/faceMatch/faceVisionCall.js';
import { getVisionModel } from './idCard/runVisionExtraction.js';
import { formatVisionApiError } from './idCard/visionUtils.js';
import { parseKycFormBody } from './parseKycFormBody.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? '3040');
const WEB_DIST = path.join(__dirname, '../dist/web');

const app = express();
app.use(
  cors({
    origin: [
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://127.0.0.1:4173',
      'http://localhost:4173',
    ],
    credentials: true,
  }),
);
app.use(express.json({ limit: '12mb' }));

function writeSse(res: express.Response, event: KycStreamEvent): void {
  res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  const flush = (res as express.Response & { flush?: () => void }).flush;
  flush?.call(res);
}

app.post('/api/kyc/stream', async (req, res) => {
  const parsed = parseKycFormBody(
    req.body as Partial<KycFormInput> & {
      documents?: KycFormInput['documents'];
      idCard?: KycFormInput['idCard'];
    },
  );
  if (!parsed.ok) {
    res.status(400).json({ ok: false, error: parsed.error });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const emit = (event: KycStreamEvent) => writeSse(res, event);

  try {
    await runKycPipeline(parsed.form, emit);
    res.end();
  } catch (err) {
    console.error('[kyc/stream]', err);
    const message = formatVisionApiError(err);
    writeSse(res, { type: 'error', message });
    res.end();
  }
});

/** ID OCR only — use to verify vision extraction without full KYC. */
app.post('/api/kyc/extract', async (req, res) => {
  const parsed = parseKycFormBody(
    req.body as Partial<KycFormInput> & { idCard?: KycFormInput['idCard'] },
    { requireSelfieWithId: false },
  );
  if (!parsed.ok) {
    res.status(400).json({ ok: false, error: parsed.error });
    return;
  }
  const idCard = parsed.form.idCard;
  const hasImage =
    idCard?.frontBase64?.trim() || idCard?.backBase64?.trim();
  if (!hasImage) {
    res.status(400).json({
      ok: false,
      error: 'idCard.frontBase64 or idCard.backBase64 is required.',
    });
    return;
  }
  if (isSkipIdVisionEnabled()) {
    res.status(400).json({
      ok: false,
      error: 'KYC_SKIP_ID_VISION=1 is set — extraction is disabled. Unset it to test OCR.',
    });
    return;
  }
  try {
    const images = normalizeIdCardUpload(idCard);
    if (!images) {
      res.status(400).json({ ok: false, error: 'No valid ID image in request.' });
      return;
    }
    const started = Date.now();
    const result = await extractNationalId({
      documentType: images.documentType,
      front: images.front,
      back: images.back,
      uploadMode: images.uploadMode,
    });
    res.json({
      ok: true,
      model: getVisionModel(),
      elapsedMs: Date.now() - started,
      documentKind: result.documentKind,
      extraction: result.raw,
      normalized: result.normalized,
    });
  } catch (err) {
    console.error('[kyc/extract]', err);
    res.status(500).json({
      ok: false,
      error: formatVisionApiError(err),
      model: getVisionModel(),
    });
  }
});

/** Face match only — ID front image + selfie (no full KYC). */
app.post('/api/kyc/face-match', async (req, res) => {
  const parsed = parseKycFormBody(
    req.body as Partial<KycFormInput> & {
      idCard?: KycFormInput['idCard'];
      selfie?: KycFormInput['selfie'];
    },
  );
  if (!parsed.ok) {
    res.status(400).json({ ok: false, error: parsed.error });
    return;
  }
  const images = normalizeIdCardUpload(parsed.form.idCard);
  if (!images || !parsed.form.selfie?.imageBase64?.trim()) {
    res.status(400).json({
      ok: false,
      error: 'idCard image and selfie.imageBase64 are required.',
    });
    return;
  }
  try {
    const started = Date.now();
    const faceMatch = await runFaceMatch({
      idFront: images.front,
      selfie: parsed.form.selfie,
      documentTypeLabel: nationalIdDocumentTypeLabel(images.documentType),
      uploadMode: images.uploadMode,
      applicantName: parsed.form.fullLegalName,
      applicantDob: parsed.form.dateOfBirth,
      onProgress: (message) => console.log(`[kyc/face-match] ${message}`),
    });
    res.json({
      ok: true,
      model: getFaceModel(),
      elapsedMs: Date.now() - started,
      faceMatch,
      idFacePreview: faceMatch.idFacePreviewDataUrl,
    });
  } catch (err) {
    console.error('[kyc/face-match]', err);
    res.status(500).json({
      ok: false,
      error: formatVisionApiError(err),
      model: getFaceModel(),
    });
  }
});

app.post('/api/kyc', async (req, res) => {
  try {
    const parsed = parseKycFormBody(
      req.body as Partial<KycFormInput> & {
        documents?: KycFormInput['documents'];
        idCard?: KycFormInput['idCard'];
      },
    );
    if (!parsed.ok) {
      res.status(400).json({ ok: false, error: parsed.error });
      return;
    }
    const result = await runKycWithOptionalIdVerification(parsed.form);
    res.json({
      ok: true,
      report: result.report,
      applicantPayload: result.applicantPayload,
      idExtraction: result.idExtraction,
      idVerification: result.idVerification,
      faceMatch: result.faceMatch,
      idFacePreview: result.idFacePreview,
    });
  } catch (err) {
    console.error('[kyc]', err);
    res.status(500).json({
      ok: false,
      error: formatVisionApiError(err),
    });
  }
});

app.post('/api/reviewer-qa', async (req, res) => {
  try {
    const body = req.body as {
      applicantPayload?: string;
      report?: unknown;
      priorExchanges?: ReviewerExchange[];
      question?: string;
    };
    const applicantPayload = String(body.applicantPayload ?? '').trim();
    const question = String(body.question ?? '').trim();
    if (!applicantPayload || !question) {
      res.status(400).json({
        ok: false,
        error: 'applicantPayload and question are required.',
      });
      return;
    }
    const parsed = kycReportSchema.safeParse(body.report);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Invalid or missing structured report.',
      });
      return;
    }
    const prior = Array.isArray(body.priorExchanges)
      ? body.priorExchanges.filter(
          (e): e is ReviewerExchange =>
            e &&
            (e.role === 'reviewer' || e.role === 'analyst') &&
            typeof e.text === 'string',
        )
      : [];
    const answer = await runReviewerQaTurn(
      applicantPayload,
      parsed.data,
      prior,
      question,
    );
    res.json({ ok: true, answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post('/api/reviewer-decision', async (req, res) => {
  try {
    const body = req.body as {
      applicantPayload?: string;
      report?: unknown;
      aiRecommendation?: string;
      finalDecision?: string;
      notes?: string;
    };
    const finalDecision = body.finalDecision;
    if (
      finalDecision !== 'approve' &&
      finalDecision !== 'reject' &&
      finalDecision !== 'refer_manual_review'
    ) {
      res.status(400).json({
        ok: false,
        error:
          'finalDecision must be approve | reject | refer_manual_review',
      });
      return;
    }
    const parsed = kycReportSchema.safeParse(body.report);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Invalid or missing structured report.',
      });
      return;
    }
    const record = {
      decidedAt: new Date().toISOString(),
      finalDecision,
      aiRecommendation: body.aiRecommendation ?? parsed.data.recommendation,
      agreesWithAi:
        (body.aiRecommendation ?? parsed.data.recommendation) ===
        finalDecision,
      notes: body.notes ? String(body.notes).slice(0, 4000) : '',
      applicantPreview: String(body.applicantPayload ?? '').slice(0, 500),
    };
    console.log('[reviewer-decision]', JSON.stringify(record, null, 2));
    res.json({ ok: true, recorded: record });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.use(express.static(WEB_DIST));

app.get('*', (_req, res, next) => {
  const index = path.join(WEB_DIST, 'index.html');
  if (!fs.existsSync(index)) {
    next();
    return;
  }
  res.sendFile(index);
});

app.use((_req, res) => {
  res
    .status(404)
    .type('text/plain')
    .send(
      'Web UI not built. Run `npm run build:web` or use Vite dev on port 5173 with `npm run dev`.',
    );
});

function logRuntimeConfig(): void {
  const vision = getVisionModel();
  const face = getFaceModel();
  const kyc = process.env.KYC_MODEL ?? '(default)';
  console.log(`[kyc] KYC_MODEL=${kyc}`);
  console.log(
    `[kyc] Vision OCR model=${vision}${process.env.KYC_VISION_MODEL ? '' : ' (same as KYC_MODEL — set KYC_VISION_MODEL=gpt-4o for faster ID reads)'}`,
  );
  const faceHint =
    process.env.KYC_FACE_MODEL || process.env.KYC_VISION_MODEL
      ? ''
      : ' (same as KYC_MODEL — set KYC_FACE_MODEL=gpt-4o for faster face match)';
  console.log(`[kyc] Face match model=${face}${faceHint}`);
  if (isSkipIdVisionEnabled()) {
    console.log('[kyc] KYC_SKIP_ID_VISION=1 — ID images will not be sent to vision API');
  }
}

const server = app.listen(PORT, () => {
  logRuntimeConfig();
  console.log(`KYC API + static UI → http://127.0.0.1:${PORT}`);
  console.log(`Dev UI: run "npm run dev" (Vite on :5173 proxies /api here).`);
  console.log(`ID extract test: POST /api/kyc/extract with idCard in JSON body`);
  console.log(`Face match test: POST /api/kyc/face-match with idCard + selfie`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use (another "npm run server" or "npm run dev" is probably running).\n` +
        `Stop that process, or use a different port, e.g.:\n` +
        `  PORT=3041 npm run server\n` +
        `If you use Vite dev, set the same port in vite.config.ts proxy target or run only one stack.`,
    );
    process.exit(1);
  }
  throw err;
});
