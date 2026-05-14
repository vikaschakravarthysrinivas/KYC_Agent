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
    'Compare parsed applicant fields against the internal demo registry (28 synthetic records). Call with best-effort structured fields extracted from the user message.',
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
2. Call **registry_lookup** once with those structured fields (name, DOB, nationality, address lines, city, state, postal, country, ID document type, ID proof reference, email, phone) before you finalize output.
3. Produce **only** the structured final object matching the schema (no extra prose outside JSON fields). Use evidence from both the submission and registry_lookup results.

Judgment rules (demo policy):
- **reject** if registry shows customerStatus blocked, deceased_customer_record, or identity_synthetic_test_profile with strong mismatch, or obvious impossible DOB for living retail product.
- **refer_manual_review** if enhanced_dd_required, pep_watchlist, prior_fraud_alert, material DOB/name/geo conflict with a plausible registry match, or ambiguous identity.
- **approve** only if verification is coherent, risk is low, and registry supports or neutral absence of concerning matches.

Tone inside string fields: concise, auditable, bullet-style sentences allowed.`,
    tools: [registryLookupTool],
  }) as unknown as Agent;
  runtimeInited = true;
}

/**
 * Runs the structured KYC assessment for a single text payload (same format as CLI).
 */
export async function runKycAssessment(payload: string): Promise<KycReport> {
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
};

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
