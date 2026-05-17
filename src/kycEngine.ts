import {
  Agent,
  MemorySession,
  OpenAIProvider,
  Runner,
  setOpenAIAPI,
  setTracingDisabled,
  tool,
} from '@openai/agents';
import { z } from 'zod';
import {
  lookupRegistry,
  type RegistryLookupInput,
} from './data/sampleRegistry.js';
import {
  compareIdToForm,
  extractNationalId,
  extractNationalIdFromForm,
  isSkipIdVisionEnabled,
  normalizeIdCardUpload,
  nationalIdDocumentTypeLabel,
  runFaceMatch,
  type FaceMatchResult,
  type IdVerificationResult,
  type NationalIdDocumentType,
  type NationalIdExtraction,
  type NationalIdExtractionResult,
  type NormalizedIdExtraction,
} from './idCard/index.js';
import { getVisionModel } from './idCard/runVisionExtraction.js';

export type { NationalIdDocumentType, NationalIdExtraction };

export type { IdVerificationResult, FaceMatchResult };

export const kycReportSchema = z.object({
  applicantProfileAndOnboardingContext: z
    .string()
    .describe(
      '1. Summarize who the applicant is, stated purpose of onboarding, and key facts from the submission.',
    ),
  missingConflictingOrSuspiciousInformation: z
    .string()
    .describe(
      '2. List missing fields, internal inconsistencies, identity or document red flags, and registry mismatches.',
    ),
  policyAndRegulatoryEvaluation: z
    .string()
    .describe(
      '3. Evaluate against internal KYC policy and relevant regulatory expectations (high level, not legal advice).',
    ),
  recommendation: z
    .enum(['approve', 'reject', 'refer_manual_review'])
    .describe(
      '4. Exactly one outcome: approve | reject | refer_manual_review (maps to Refer / Manual Review).',
    ),
  justificationWithEvidence: z
    .string()
    .describe(
      '5. Tie the recommendation to concrete evidence: submission text, registry tool results, flags, and policy hooks.',
    ),
  reviewerFollowUpBriefing: z.object({
    whatWasFound: z
      .string()
      .describe('For reviewer Q&A: material findings in plain language.'),
    whatIsMissing: z
      .string()
      .describe('For reviewer Q&A: gaps still needed if any.'),
    policyOrRuleTriggers: z
      .array(z.string())
      .describe('For reviewer Q&A: internal rules or risk drivers cited.'),
  }),
});

export type KycReport = z.infer<typeof kycReportSchema>;

const registryLookupTool = tool({
  name: 'registry_lookup',
  description:
    'Compare parsed applicant fields against the internal demo registry (41 synthetic records). Call with best-effort structured fields extracted from the user message.',
  parameters: z.object({
    fullLegalName: z.string().optional(),
    dateOfBirth: z.string().optional(),
    nationality: z.string().optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    city: z.string().optional(),
    stateRegion: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    idDocumentType: z.string().optional(),
    idProofNumber: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
  }),
  async execute(fields: RegistryLookupInput) {
    return lookupRegistry(fields);
  },
});

/** Set during {@link runKycWithOptionalIdVerification} when an ID image was processed. */
let lastIdVerification: IdVerificationResult | null = null;
let lastFaceMatch: FaceMatchResult | null = null;

const idDocumentVerifyTool = tool({
  name: 'id_document_verify',
  description:
    'Returns deterministic comparison of web-form applicant fields vs PII extracted from uploaded India driving licence. Only meaningful when ID images were uploaded for this case.',
  parameters: z.object({}),
  async execute() {
    if (!lastIdVerification) {
      return {
        performed: false,
        message: 'No ID document was uploaded for this assessment.',
      };
    }
    return {
      performed: true,
      ...lastIdVerification,
    };
  },
});

const faceMatchVerifyTool = tool({
  name: 'face_match_verify',
  description:
    'Returns demo selfie vs ID portrait face comparison (static photo match, not video liveness). Only when selfie and ID were uploaded.',
  parameters: z.object({}),
  async execute() {
    if (!lastFaceMatch) {
      return {
        performed: false,
        message: 'No face match was performed for this assessment.',
      };
    }
    return {
      performed: true,
      overallStatus: lastFaceMatch.overallStatus,
      confidenceScore: lastFaceMatch.confidenceScore,
      facialFeatureNotes: lastFaceMatch.facialFeatureNotes,
      livenessNotes: lastFaceMatch.livenessNotes,
      recommendation: lastFaceMatch.recommendation,
      summaryForAgent: lastFaceMatch.summaryForAgent,
    };
  },
});

function getModel(): string {
  return process.env.KYC_MODEL ?? 'us.anthropic.claude-opus-4-5-20251101-v1:0';
}

function getMaxTurns(): number {
  return Number(process.env.KYC_MAX_TURNS ?? '40');
}

export function getModelProvider(): OpenAIProvider {
  const apiKey = process.env.LITELLM_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing LITELLM_API_KEY or OPENAI_API_KEY. Configure environment before running KYC.',
    );
  }
  const baseURL =
    process.env.LITELLM_BASE_URL ?? process.env.OPENAI_BASE_URL ?? undefined;
  return new OpenAIProvider({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });
}

let runtimeInited = false;
let kycStructuredAgent: Agent | null = null;

function ensureRuntime(): void {
  if (runtimeInited) return;
  setOpenAIAPI('chat_completions');
  setTracingDisabled(true);
  const model = getModel();
  kycStructuredAgent = new Agent({
    name: 'KYC Decisioning',
    model,
    handoffDescription:
      'Produces a structured KYC assessment from a single applicant payload.',
    outputType: kycReportSchema,
    instructions: `You assess a **single-block** applicant submission (often lines like "Name: ..., DOB: ..., Address: ...").

Workflow:
1. Parse all identifiable fields from the user text (name, DOB, address, city, state, postal code, country, nationality, onboarding channel, documents on file). Accept common labels (Name, DOB, Address, City, State, Pin, ZIP, Country).
2. If the submission includes <<<ID_DOCUMENT_VERIFICATION>>> … <<<END_ID_DOCUMENT_VERIFICATION>>>, call **id_document_verify** once (no parameters) and use its field-level comparison in your assessment.
3. If the submission includes <<<FACE_MATCH_VERIFICATION>>> … <<<END_FACE_MATCH_VERIFICATION>>>, call **face_match_verify** once (no parameters) and use its results (demo static photo match, not true liveness).
4. Call **registry_lookup** once with structured fields from the submission before you finalize output.
5. Produce **only** the structured final object matching the schema (no extra prose outside JSON fields). Use evidence from the submission, id_document_verify, face_match_verify (when present), and registry_lookup.

Judgment rules (demo policy):
- **reject** if registry shows customerStatus blocked, deceased_customer_record, or identity_synthetic_test_profile with strong mismatch; or obvious impossible DOB; or ID verification overallStatus is **mismatch** on name+DOB together with high confidence; or face_match_verify overallStatus is **no_match** with confidenceScore >= 70.
- **refer_manual_review** if enhanced_dd_required, pep_watchlist, prior_fraud_alert, material DOB/name/geo conflict with registry, ID **mismatch** or **partial_match**, expired document (documentExpired), alternate ID number conflict, face **likely_match** with low confidence, face **unable_to_verify**, or ambiguous identity.
- **approve** only if verification is coherent, risk is low, registry supports or neutral, ID verification (if performed) is **match** or acceptable **partial_match** on non-critical fields only, and face match (if performed) is **match** or acceptable **likely_match** with confidenceScore >= 60.

Tone inside string fields: concise, auditable, bullet-style sentences allowed.`,
    tools: [registryLookupTool, idDocumentVerifyTool, faceMatchVerifyTool],
  }) as unknown as Agent;
  runtimeInited = true;
}

/**
 * Runs the structured KYC assessment for a single text payload (same format as CLI).
 */
export async function runKycAssessment(payload: string): Promise<KycReport> {
  lastIdVerification = null;
  return runKycAssessmentPayload(payload);
}

async function runKycAssessmentPayload(payload: string): Promise<KycReport> {
  ensureRuntime();
  const runner = new Runner({ modelProvider: getModelProvider() });
  const result = await runner.run(
    kycStructuredAgent!,
    `Applicant submission (single block):\n\n${payload.trim()}`,
    { maxTurns: getMaxTurns() },
  );
  const report = result.finalOutput as KycReport | undefined;
  if (!report) {
    throw new Error('No structured output returned from the KYC agent.');
  }
  return report;
}

/**
 * Same as {@link runKycAssessment} but persists the turn into `session` (for reviewer follow-up CLI).
 */
export async function runKycAssessmentWithSession(
  payload: string,
  session: MemorySession,
): Promise<KycReport> {
  lastIdVerification = null;
  ensureRuntime();
  const runner = new Runner({ modelProvider: getModelProvider() });
  const result = await runner.run(
    kycStructuredAgent!,
    `Applicant submission (single block):\n\n${payload.trim()}`,
    { session, maxTurns: getMaxTurns() },
  );
  const report = result.finalOutput as KycReport | undefined;
  if (!report) {
    throw new Error('No structured output returned from the KYC agent.');
  }
  return report;
}

export function createReviewerQaAgent(): Agent {
  return new Agent({
    name: 'KYC Reviewer QA',
    model: getModel(),
    handoffDescription:
      'Answers follow-up questions from a human reviewer using embedded case context.',
    instructions: `You assist a **human compliance reviewer** after an automated KYC structured assessment.

Each user message uses tagged sections:
- <<<APPLICANT_SUBMISSION>>> … <<<END_APPLICANT_SUBMISSION>>>
- <<<STRUCTURED_REPORT_JSON>>> … <<<END_STRUCTURED_REPORT_JSON>>>
- <<<PRIOR_QA>>> … <<<END_PRIOR_QA>>> (may be "(none)")
- <<<REVIEWER_QUESTION>>> … <<<END_REVIEWER_QUESTION>>>

Rules:
- Answer **only** the REVIEWER_QUESTION using evidence from the submission and structured JSON. Do not invent registry rows or facts not supported by the packet.
- Stay consistent with PRIOR_QA unless you are correcting an acknowledged error.
- If something is not in the packet, say it is not in the record.
- Keep answers concise and audit-friendly; use short headings when helpful.`,
  });
}

export type ReviewerExchange = {
  role: 'reviewer' | 'analyst';
  text: string;
};

export function buildReviewerQaUserMessage(
  applicantPayload: string,
  report: KycReport,
  priorExchanges: ReviewerExchange[],
  question: string,
): string {
  const prior =
    priorExchanges.length === 0
      ? '(none)'
      : priorExchanges
          .map((e) =>
            e.role === 'reviewer'
              ? `Reviewer: ${e.text}`
              : `Analyst: ${e.text}`,
          )
          .join('\n\n');

  return `<<<APPLICANT_SUBMISSION>>>
${applicantPayload.trim()}
<<<END_APPLICANT_SUBMISSION>>>

<<<STRUCTURED_REPORT_JSON>>>
${JSON.stringify(report, null, 2)}
<<<END_STRUCTURED_REPORT_JSON>>>

<<<PRIOR_QA>>>
${prior}
<<<END_PRIOR_QA>>>

<<<REVIEWER_QUESTION>>>
${question.trim()}
<<<END_REVIEWER_QUESTION>>>`;
}

/**
 * Stateless reviewer Q&A turn for web/API (no MemorySession).
 */
export async function runReviewerQaTurn(
  applicantPayload: string,
  report: KycReport,
  priorExchanges: ReviewerExchange[],
  question: string,
): Promise<string> {
  ensureRuntime();
  const runner = new Runner({ modelProvider: getModelProvider() });
  const agent = createReviewerQaAgent();
  const input = buildReviewerQaUserMessage(
    applicantPayload,
    report,
    priorExchanges,
    question,
  );
  const result = await runner.run(agent, input, { maxTurns: 22 });
  const out = result.finalOutput;
  if (typeof out === 'string' && out.trim()) return out.trim();
  return String(out ?? '(no reply)');
}

export type FinalHumanDisposition =
  | 'approve'
  | 'reject'
  | 'refer_manual_review';

export function formatReport(r: KycReport): string {
  const recLabel =
    r.recommendation === 'approve'
      ? 'Approve'
      : r.recommendation === 'reject'
        ? 'Reject'
        : 'Refer / Manual Review';

  const triggers = r.reviewerFollowUpBriefing.policyOrRuleTriggers
    .map((x) => `     – ${x}`)
    .join('\n');

  return `
══════════════════════════════════════════════════════════════
 KYC ASSESSMENT (structured)
══════════════════════════════════════════════════════════════

1) Applicant profile & onboarding context
${r.applicantProfileAndOnboardingContext}

2) Missing, conflicting, or suspicious information
${r.missingConflictingOrSuspiciousInformation}

3) Policy & regulatory evaluation
${r.policyAndRegulatoryEvaluation}

4) Recommendation: ${recLabel}

5) Justification (with evidence)
${r.justificationWithEvidence}

6) Reviewer follow-up briefing
   • What was found
${r.reviewerFollowUpBriefing.whatWasFound}

   • What is missing
${r.reviewerFollowUpBriefing.whatIsMissing}

   • Policy / rule triggers
${triggers}
══════════════════════════════════════════════════════════════
`;
}

export type IdCardUploadInput = {
  /** Defaults to india_driving_licence when images are sent. */
  documentType?: NationalIdDocumentType;
  frontBase64: string;
  frontMimeType?: string;
  backBase64?: string;
  backMimeType?: string;
};

export type KycFormInput = {
  fullLegalName: string;
  dateOfBirth: string;
  nationality?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  onboardingChannel?: string;
  idDocumentType?: string;
  idProofNumber?: string;
  email?: string;
  phone?: string;
  documents?: {
    applicationForm?: boolean;
    idProof?: boolean;
    addressProof?: boolean;
    selfie?: boolean;
  };
  idCard?: IdCardUploadInput;
  selfie?: {
    imageBase64: string;
    mimeType?: string;
  };
};

export type KycRunResult = {
  report: KycReport;
  applicantPayload: string;
  idExtraction?: NationalIdExtraction;
  idVerification?: IdVerificationResult;
  faceMatch?: FaceMatchResult;
  idFacePreview?: string;
};

function appendFaceMatchBlock(
  payload: string,
  faceMatch: FaceMatchResult,
): string {
  return `${payload}

<<<FACE_MATCH_VERIFICATION>>>
${faceMatch.summaryForAgent}
<<<END_FACE_MATCH_VERIFICATION>>>`;
}

function appendIdVerificationBlock(
  payload: string,
  verification: IdVerificationResult,
  extraction: NationalIdExtractionResult,
): string {
  return `${payload}

<<<ID_DOCUMENT_VERIFICATION>>>
Document type: ${extraction.normalized.documentType} (uploaded)
Extracted (from card): ${JSON.stringify(extraction.raw, null, 2)}

${verification.summaryForAgent}
<<<END_ID_DOCUMENT_VERIFICATION>>>`;
}

/**
 * Runs KYC on form data; if idCard images are present, extracts PII, compares to form, then assesses.
 */
export async function runKycWithOptionalIdVerification(
  form: KycFormInput,
): Promise<KycRunResult> {
  lastIdVerification = null;
  lastFaceMatch = null;
  const prepared = await prepareIdFromForm(form);
  const report = await runKycAssessmentPayload(prepared.payload);
  return {
    report,
    applicantPayload: prepared.payload,
    idExtraction: prepared.idExtraction,
    idVerification: prepared.idVerification,
    faceMatch: prepared.faceMatch,
    idFacePreview: prepared.idFacePreview,
  };
}

/**
 * Builds the single-block payload string expected by {@link runKycAssessment}.
 */
export function formInputToPayload(form: KycFormInput): string {
  const lines: string[] = [];
  lines.push(`Name: ${form.fullLegalName}`);
  lines.push(`DOB: ${form.dateOfBirth}`);
  if (form.nationality?.trim()) {
    lines.push(`Nationality: ${form.nationality.trim()}`);
  }
  lines.push(`Address: ${form.addressLine1}`);
  if (form.addressLine2?.trim()) {
    lines.push(`Address line 2: ${form.addressLine2.trim()}`);
  }
  lines.push(`City: ${form.city}`);
  lines.push(`State: ${form.stateRegion}`);
  lines.push(`Pin: ${form.postalCode}`);
  lines.push(`Country: ${form.country}`);
  if (form.idDocumentType?.trim()) {
    lines.push(`ID document type: ${form.idDocumentType.trim()}`);
  }
  if (form.idProofNumber?.trim()) {
    lines.push(`ID proof number / ref: ${form.idProofNumber.trim()}`);
  }
  if (form.email?.trim()) {
    lines.push(`Email: ${form.email.trim()}`);
  }
  if (form.phone?.trim()) {
    lines.push(`Phone: ${form.phone.trim()}`);
  }
  if (form.onboardingChannel?.trim()) {
    lines.push(`Onboarding channel: ${form.onboardingChannel.trim()}`);
  }
  const d = form.documents;
  if (d) {
    const received: string[] = [];
    if (d.applicationForm) received.push('Application Form');
    if (d.idProof) received.push('ID Proof');
    if (d.addressProof) received.push('Address Proof');
    if (d.selfie) received.push('Selfie / liveness');
    if (received.length) {
      lines.push(`Documents received (per applicant): ${received.join(', ')}`);
    }
  }
  return lines.join(', ');
}

export type KycStreamEvent =
  | { type: 'status'; message: string }
  | {
      type: 'id_extracted';
      extraction: NationalIdExtraction;
      normalized: NormalizedIdExtraction;
    }
  | { type: 'id_compared'; verification: IdVerificationResult }
  | { type: 'face_cropped'; idFacePreview: string }
  | { type: 'face_compared'; faceMatch: FaceMatchResult }
  | { type: 'kyc_progress'; message: string; tool?: string }
  | { type: 'complete'; result: KycRunResult }
  | { type: 'error'; message: string };

export type KycStreamEmitter = (event: KycStreamEvent) => void;

async function prepareIdFromForm(
  form: KycFormInput,
  emit?: KycStreamEmitter,
): Promise<{
  payload: string;
  idExtraction?: NationalIdExtraction;
  idVerification?: IdVerificationResult;
  extracted?: NationalIdExtractionResult;
  faceMatch?: FaceMatchResult;
  idFacePreview?: string;
}> {
  let payload = formInputToPayload(form);
  let idExtraction: NationalIdExtraction | undefined;
  let idVerification: IdVerificationResult | undefined;
  let extracted: NationalIdExtractionResult | undefined;
  let faceMatch: FaceMatchResult | undefined;
  let idFacePreview: string | undefined;

  const idImages = normalizeIdCardUpload(form.idCard);
  if (!idImages) {
    return { payload, idExtraction, idVerification, faceMatch, idFacePreview };
  }

  const docType = idImages.documentType;
  const docLabel = nationalIdDocumentTypeLabel(docType);
  const modeLabel =
    idImages.uploadMode === 'front_and_back'
      ? 'separate front + back images'
      : 'single combined image';

  const facePromise = form.selfie?.imageBase64?.trim()
    ? runFaceMatch({
        idFront: idImages.front,
        selfie: form.selfie,
        documentTypeLabel: docLabel,
        uploadMode: idImages.uploadMode,
        applicantName: form.fullLegalName,
        applicantDob: form.dateOfBirth,
        onProgress: (message) => emit?.({ type: 'status', message }),
        onFaceCropped: (preview) => {
          idFacePreview = preview;
          emit?.({ type: 'face_cropped', idFacePreview: preview });
        },
      })
    : undefined;

  if (facePromise) {
    emit?.({
      type: 'status',
      message: `ID upload: ${modeLabel}. Running OCR and face match in parallel…`,
    });
  }

  let extractPromise: Promise<NationalIdExtractionResult>;
  if (isSkipIdVisionEnabled()) {
    emit?.({
      type: 'status',
      message: `ID upload: ${modeLabel}. Using form fields (KYC_SKIP_ID_VISION=1)…`,
    });
    extractPromise = Promise.resolve(extractNationalIdFromForm(form, docType));
  } else {
    extractPromise = extractNationalId({
      documentType: docType,
      front: idImages.front,
      back: idImages.back,
      uploadMode: idImages.uploadMode,
      onProgress: (message) => emit?.({ type: 'status', message }),
    });
  }

  const [extractedResult, faceResult] = await Promise.all([
    extractPromise,
    facePromise ?? Promise.resolve(undefined),
  ]);

  extracted = extractedResult;
  idExtraction = extracted.raw;
  idVerification = compareIdToForm(form, extracted.normalized);
  lastIdVerification = idVerification;
  payload = appendIdVerificationBlock(payload, idVerification, extracted);

  if (!form.idDocumentType?.trim()) {
    payload += `, ID document type: ${extracted.normalized.documentType}`;
  }

  if (faceResult) {
    faceMatch = faceResult;
    lastFaceMatch = faceMatch;
    idFacePreview = faceMatch.idFacePreviewDataUrl;
    emit?.({ type: 'face_compared', faceMatch });
    payload = appendFaceMatchBlock(payload, faceMatch);
  }

  return { payload, idExtraction, idVerification, extracted, faceMatch, idFacePreview };
}

async function runKycAssessmentPayloadStream(
  payload: string,
  emit: KycStreamEmitter,
): Promise<KycReport> {
  ensureRuntime();
  const runner = new Runner({ modelProvider: getModelProvider() });
  emit({ type: 'kyc_progress', message: 'Starting KYC assessment agent…' });

  const stream = await runner.run(
    kycStructuredAgent!,
    `Applicant submission (single block):\n\n${payload.trim()}`,
    { maxTurns: getMaxTurns(), stream: true },
  );

  for await (const event of stream) {
    if (event.type === 'run_item_stream_event') {
      if (event.name === 'tool_called') {
        const raw = event.item as { rawItem?: { name?: string } };
        const tool = raw.rawItem?.name ?? 'tool';
        emit({
          type: 'kyc_progress',
          message: `Calling ${tool}…`,
          tool,
        });
      } else if (event.name === 'tool_output') {
        emit({
          type: 'kyc_progress',
          message: 'Tool finished; continuing assessment…',
        });
      }
    }
  }

  await stream.completed;
  if (stream.error) {
    throw stream.error;
  }

  const report = stream.finalOutput as KycReport | undefined;
  if (!report) {
    throw new Error('No structured output returned from the KYC agent.');
  }
  emit({ type: 'kyc_progress', message: 'KYC assessment complete.' });
  return report;
}

/**
 * Full KYC with staged SSE-friendly events: ID extract → compare → KYC agent.
 */
export async function runKycPipeline(
  form: KycFormInput,
  emit: KycStreamEmitter,
): Promise<KycRunResult> {
  lastIdVerification = null;
  lastFaceMatch = null;
  emit({ type: 'status', message: 'Validating applicant form…' });

  const hasIdUpload =
    form.idCard?.frontBase64?.trim() || form.idCard?.backBase64?.trim();
  if (hasIdUpload) {
    if (isSkipIdVisionEnabled()) {
      emit({
        type: 'status',
        message:
          'Fast demo: skipping vision OCR (KYC_SKIP_ID_VISION=1), using form fields…',
      });
    } else {
      emit({
        type: 'status',
        message: `Reading ID with vision model (${getVisionModel()})…`,
      });
    }
    const prepared = await prepareIdFromForm(form, emit);
    if (prepared.extracted) {
      emit({
        type: 'id_extracted',
        extraction: prepared.extracted.raw,
        normalized: prepared.extracted.normalized,
      });
      emit({ type: 'status', message: 'Comparing extracted ID fields to your form…' });
    }
    if (prepared.idVerification) {
      emit({ type: 'id_compared', verification: prepared.idVerification });
    }
    emit({
      type: 'status',
      message: 'Running registry lookup and KYC policy assessment…',
    });
    const report = await runKycAssessmentPayloadStream(prepared.payload, emit);
    const result: KycRunResult = {
      report,
      applicantPayload: prepared.payload,
      idExtraction: prepared.idExtraction,
      idVerification: prepared.idVerification,
      faceMatch: prepared.faceMatch,
      idFacePreview: prepared.idFacePreview,
    };
    emit({ type: 'complete', result });
    return result;
  }

  emit({ type: 'status', message: 'No ID image; running KYC on form data only…' });
  const payload = formInputToPayload(form);
  const report = await runKycAssessmentPayloadStream(payload, emit);
  const result: KycRunResult = {
    report,
    applicantPayload: payload,
  };
  emit({ type: 'complete', result });
  return result;
}
