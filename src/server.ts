import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formInputToPayload,
  kycReportSchema,
  runKycAssessment,
  runReviewerQaTurn,
  type KycFormInput,
  type ReviewerExchange,
} from './kycEngine.js';

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
app.use(express.json({ limit: '1mb' }));

app.post('/api/kyc', async (req, res) => {
  try {
    const body = req.body as Partial<KycFormInput> & {
      documents?: KycFormInput['documents'];
    };
    const required = [
      'fullLegalName',
      'dateOfBirth',
      'addressLine1',
      'city',
      'stateRegion',
      'postalCode',
      'country',
    ] as const;
    const missing = required.filter((k) => !String(body[k] ?? '').trim());
    if (missing.length) {
      res.status(400).json({
        ok: false,
        error: `Missing required fields: ${missing.join(', ')}`,
      });
      return;
    }
    const form: KycFormInput = {
      fullLegalName: String(body.fullLegalName).trim(),
      dateOfBirth: String(body.dateOfBirth).trim(),
      nationality: body.nationality ? String(body.nationality).trim() : undefined,
      addressLine1: String(body.addressLine1).trim(),
      addressLine2: body.addressLine2
        ? String(body.addressLine2).trim()
        : undefined,
      city: String(body.city).trim(),
      stateRegion: String(body.stateRegion).trim(),
      postalCode: String(body.postalCode).trim(),
      country: String(body.country).trim(),
      onboardingChannel: body.onboardingChannel
        ? String(body.onboardingChannel).trim()
        : undefined,
      idDocumentType: body.idDocumentType
        ? String(body.idDocumentType).trim()
        : undefined,
      idProofNumber: body.idProofNumber
        ? String(body.idProofNumber).trim()
        : undefined,
      email: body.email ? String(body.email).trim() : undefined,
      phone: body.phone ? String(body.phone).trim() : undefined,
      documents: body.documents,
    };
    const payload = formInputToPayload(form);
    const report = await runKycAssessment(payload);
    res.json({ ok: true, report, applicantPayload: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
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

const server = app.listen(PORT, () => {
  console.log(`KYC API + static UI → http://127.0.0.1:${PORT}`);
  console.log(`Dev UI: run "npm run dev" (Vite on :5173 proxies /api here).`);
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
