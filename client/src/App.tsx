import { FormEvent, useMemo, useState } from 'react';

type ReviewerExchange = {
  role: 'reviewer' | 'analyst';
  text: string;
};

type FinalDisposition = 'approve' | 'reject' | 'refer_manual_review';

type KycReport = {
  applicantProfileAndOnboardingContext: string;
  missingConflictingOrSuspiciousInformation: string;
  policyAndRegulatoryEvaluation: string;
  recommendation: 'approve' | 'reject' | 'refer_manual_review';
  justificationWithEvidence: string;
  reviewerFollowUpBriefing: {
    whatWasFound: string;
    whatIsMissing: string;
    policyOrRuleTriggers: string[];
  };
};

type FormState = {
  fullLegalName: string;
  dateOfBirth: string;
  nationality: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  onboardingChannel: string;
  idDocumentType: string;
  idProofNumber: string;
  email: string;
  phone: string;
  applicationForm: boolean;
  idProof: boolean;
  addressProof: boolean;
  selfie: boolean;
};

const initialForm: FormState = {
  fullLegalName: '',
  dateOfBirth: '',
  nationality: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  stateRegion: '',
  postalCode: '',
  country: '',
  onboardingChannel: 'Mobile App',
  idDocumentType: '',
  idProofNumber: '',
  email: '',
  phone: '',
  applicationForm: true,
  idProof: true,
  addressProof: true,
  selfie: false,
};

function recommendationLabel(r: KycReport['recommendation']): string {
  if (r === 'approve') return 'Approve';
  if (r === 'reject') return 'Reject';
  return 'Refer / Manual Review';
}

function badgeClass(r: KycReport['recommendation']): string {
  if (r === 'approve') return 'badge badge--ok';
  if (r === 'reject') return 'badge badge--bad';
  return 'badge badge--review';
}

export function App() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<KycReport | null>(null);
  const [applicantPayload, setApplicantPayload] = useState<string | null>(
    null,
  );
  const [qaMessages, setQaMessages] = useState<ReviewerExchange[]>([]);
  const [qaDraft, setQaDraft] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  const [selectedDecision, setSelectedDecision] =
    useState<FinalDisposition | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const [decisionRecorded, setDecisionRecorded] = useState<unknown>(null);

  const canSubmit = useMemo(() => {
    return (
      form.fullLegalName.trim() &&
      form.dateOfBirth.trim() &&
      form.addressLine1.trim() &&
      form.city.trim() &&
      form.stateRegion.trim() &&
      form.postalCode.trim() &&
      form.country.trim()
    );
  }, [form]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setReport(null);
    setApplicantPayload(null);
    setQaMessages([]);
    setQaDraft('');
    setSelectedDecision(null);
    setReviewerNotes('');
    setDecisionRecorded(null);
    setLoading(true);
    try {
      const res = await fetch('/api/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullLegalName: form.fullLegalName,
          dateOfBirth: form.dateOfBirth,
          nationality: form.nationality || undefined,
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2 || undefined,
          city: form.city,
          stateRegion: form.stateRegion,
          postalCode: form.postalCode,
          country: form.country,
          onboardingChannel: form.onboardingChannel || undefined,
          idDocumentType: form.idDocumentType || undefined,
          idProofNumber: form.idProofNumber || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          documents: {
            applicationForm: form.applicationForm,
            idProof: form.idProof,
            addressProof: form.addressProof,
            selfie: form.selfie,
          },
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        report?: KycReport;
        applicantPayload?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.report) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      setReport(data.report);
      setApplicantPayload(data.applicantPayload ?? null);
      setSelectedDecision(data.report.recommendation);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function sendReviewerQuestion() {
    if (!report || !applicantPayload?.trim()) return;
    const q = qaDraft.trim();
    if (!q) return;
    setQaLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reviewer-qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantPayload,
          report,
          priorExchanges: qaMessages,
          question: q,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        answer?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || data.answer == null) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      setQaMessages((prev) => [
        ...prev,
        { role: 'reviewer', text: q },
        { role: 'analyst', text: data.answer! },
      ]);
      setQaDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setQaLoading(false);
    }
  }

  async function confirmHumanDisposition() {
    if (!report || !applicantPayload?.trim() || !selectedDecision) return;
    setDecisionSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/reviewer-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantPayload,
          report,
          aiRecommendation: report.recommendation,
          finalDecision: selectedDecision,
          notes: reviewerNotes,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        recorded?: unknown;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      setDecisionRecorded(data.recorded ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDecisionSubmitting(false);
    }
  }

  const overridesAi =
    report &&
    selectedDecision != null &&
    selectedDecision !== report.recommendation;

  return (
    <div className="app">
      <header className="header">
        <div className="header__brand">
          <div className="logo" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <div>
            <h1 className="header__title">KYC Review Assistant</h1>
            <p className="header__subtitle">Purple Fabric Banking</p>
          </div>
        </div>
        <div className="header__user">
          <span className="avatar" aria-hidden>
            JS
          </span>
          <span>John Smith</span>
        </div>
      </header>

      <main className="main">
        <section className="panel">
          <h2 className="panel__title">Applicant intake</h2>
          <p className="panel__hint">
            Complete the form and submit for an AI-assisted KYC assessment
            against the demo internal registry.
          </p>
          <form className="form" onSubmit={onSubmit}>
            <div className="grid2">
              <label className="field">
                <span>Full legal name *</span>
                <input
                  required
                  value={form.fullLegalName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fullLegalName: e.target.value }))
                  }
                  placeholder="Sarah Chen"
                />
              </label>
              <label className="field">
                <span>Date of birth *</span>
                <input
                  required
                  type="text"
                  value={form.dateOfBirth}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dateOfBirth: e.target.value }))
                  }
                  placeholder="1992-04-17 or 15 Mar 1992"
                />
              </label>
            </div>
            <label className="field">
              <span>Nationality</span>
              <input
                value={form.nationality}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nationality: e.target.value }))
                }
                placeholder="United Kingdom"
              />
            </label>
            <label className="field">
              <span>Street address *</span>
              <input
                required
                value={form.addressLine1}
                onChange={(e) =>
                  setForm((f) => ({ ...f, addressLine1: e.target.value }))
                }
                placeholder="45 Victoria Street"
              />
            </label>
            <label className="field">
              <span>Address line 2 (unit, floor)</span>
              <input
                value={form.addressLine2}
                onChange={(e) =>
                  setForm((f) => ({ ...f, addressLine2: e.target.value }))
                }
                placeholder="Floor 3, Suite 12B"
              />
            </label>
            <div className="grid3">
              <label className="field">
                <span>City *</span>
                <input
                  required
                  value={form.city}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, city: e.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>State / region *</span>
                <input
                  required
                  value={form.stateRegion}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, stateRegion: e.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Postal code *</span>
                <input
                  required
                  value={form.postalCode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, postalCode: e.target.value }))
                  }
                />
              </label>
            </div>
            <label className="field">
              <span>Country *</span>
              <input
                required
                value={form.country}
                onChange={(e) =>
                  setForm((f) => ({ ...f, country: e.target.value }))
                }
              />
            </label>
            <div className="grid2">
              <label className="field">
                <span>ID document type</span>
                <input
                  value={form.idDocumentType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, idDocumentType: e.target.value }))
                  }
                  placeholder="Passport, PAN, National ID…"
                />
              </label>
              <label className="field">
                <span>ID proof number / reference</span>
                <input
                  value={form.idProofNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, idProofNumber: e.target.value }))
                  }
                  placeholder="e.g. SYN-IN-AAD-9217-8842 (demo registry)"
                />
              </label>
            </div>
            <div className="grid2">
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="applicant@example.com"
                />
              </label>
              <label className="field">
                <span>Phone</span>
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+91-70000-00002"
                />
              </label>
            </div>
            <label className="field">
              <span>Onboarding channel</span>
              <select
                value={form.onboardingChannel}
                onChange={(e) =>
                  setForm((f) => ({ ...f, onboardingChannel: e.target.value }))
                }
              >
                <option>Mobile App</option>
                <option>Web</option>
                <option>Branch</option>
                <option>Partner API</option>
              </select>
            </label>
            <fieldset className="checks">
              <legend>Documents (declared)</legend>
              <label>
                <input
                  type="checkbox"
                  checked={form.applicationForm}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      applicationForm: e.target.checked,
                    }))
                  }
                />{' '}
                Application form
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.idProof}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, idProof: e.target.checked }))
                  }
                />{' '}
                ID proof
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.addressProof}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, addressProof: e.target.checked }))
                  }
                />{' '}
                Address proof
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.selfie}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, selfie: e.target.checked }))
                  }
                />{' '}
                Selfie / liveness
              </label>
            </fieldset>
            <div className="actions">
              <button
                className="btn btn--primary"
                type="submit"
                disabled={!canSubmit || loading}
              >
                {loading ? 'Running KYC…' : 'Run KYC assessment'}
              </button>
            </div>
          </form>
        </section>

        {error ? (
          <section className="panel panel--error">
            <h2 className="panel__title">Error</h2>
            <pre className="pre">{error}</pre>
          </section>
        ) : null}

        {report ? (
          <div className="results">
            <section className="panel panel--accent">
              <h2 className="panel__title">AI assessment</h2>
              <h3 className="h3 h3--tight">4. Recommendation</h3>
              <div className="ai-row">
                <span className="muted">Recommended outcome</span>
                <span className={badgeClass(report.recommendation)}>
                  {recommendationLabel(report.recommendation)}
                </span>
              </div>
            </section>

            <div className="cols">
              <section className="panel">
                <h3 className="h3">1. Applicant profile & context</h3>
                <p className="prose">{report.applicantProfileAndOnboardingContext}</p>
              </section>
              <section className="panel">
                <h3 className="h3">2. Missing / conflicts / suspicion</h3>
                <p className="prose">
                  {report.missingConflictingOrSuspiciousInformation}
                </p>
              </section>
            </div>

            <section className="panel">
              <h3 className="h3">3. Policy & regulatory evaluation</h3>
              <p className="prose">{report.policyAndRegulatoryEvaluation}</p>
            </section>

            <section className="panel">
              <h3 className="h3">5. Justification (with evidence)</h3>
              <p className="prose">{report.justificationWithEvidence}</p>
            </section>

            <section className="panel">
              <h3 className="h3">6. Reviewer follow-up briefing</h3>
              <ul className="list">
                <li>
                  <strong>What was found:</strong>{' '}
                  {report.reviewerFollowUpBriefing.whatWasFound}
                </li>
                <li>
                  <strong>What is missing:</strong>{' '}
                  {report.reviewerFollowUpBriefing.whatIsMissing}
                </li>
                <li>
                  <strong>Policy / rule triggers:</strong>
                  <ul>
                    {report.reviewerFollowUpBriefing.policyOrRuleTriggers.map(
                      (t) => (
                        <li key={t}>{t}</li>
                      ),
                    )}
                  </ul>
                </li>
              </ul>
            </section>

            <section className="panel reviewer-workspace">
              <h2 className="panel__title">Reviewer workspace</h2>
              <p className="panel__hint">
                The AI output is <strong>decision support only</strong>. You
                remain accountable for the final disposition. Use the
                recommendation and briefing to guide your judgment; document
                any override in the notes.
              </p>

              <div className="callout callout--guide">
                <h3 className="h3 h3--tight">Use the AI recommendation</h3>
                <ul className="list list--tight">
                  <li>
                    <strong>Suggested outcome:</strong>{' '}
                    <span className={badgeClass(report.recommendation)}>
                      {recommendationLabel(report.recommendation)}
                    </span>
                  </li>
                  <li>
                    <strong>Key findings:</strong>{' '}
                    {report.reviewerFollowUpBriefing.whatWasFound}
                  </li>
                  <li>
                    <strong>Gaps to resolve:</strong>{' '}
                    {report.reviewerFollowUpBriefing.whatIsMissing}
                  </li>
                  <li>
                    <strong>Policy / risk drivers:</strong>{' '}
                    {report.reviewerFollowUpBriefing.policyOrRuleTriggers.join(
                      '; ',
                    )}
                  </li>
                </ul>
              </div>

              {overridesAi ? (
                <div className="callout callout--warn" role="status">
                  You selected{' '}
                  <strong>{recommendationLabel(selectedDecision!)}</strong>,
                  which differs from the AI suggestion (
                  {recommendationLabel(report.recommendation)}). Ensure your
                  notes explain the override for audit.
                </div>
              ) : null}

              <h3 className="h3">Ask the analyst (optional)</h3>
              <p className="muted small">
                Follow-up questions use the same applicant packet and structured
                report. Replies are for guidance only.
              </p>
              <div className="thread" aria-live="polite">
                {qaMessages.length === 0 ? (
                  <p className="muted small">No questions yet.</p>
                ) : (
                  qaMessages.map((m, i) => (
                    <div
                      key={`${i}-${m.role}`}
                      className={
                        m.role === 'reviewer'
                          ? 'thread__msg thread__msg--reviewer'
                          : 'thread__msg thread__msg--analyst'
                      }
                    >
                      <span className="thread__label">
                        {m.role === 'reviewer' ? 'You' : 'Analyst'}
                      </span>
                      <p className="thread__text">{m.text}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="qa-row">
                <input
                  className="qa-input"
                  type="text"
                  value={qaDraft}
                  onChange={(e) => setQaDraft(e.target.value)}
                  placeholder="e.g. Why was PEP risk discounted?"
                  disabled={qaLoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendReviewerQuestion();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={qaLoading || !qaDraft.trim()}
                  onClick={() => void sendReviewerQuestion()}
                >
                  {qaLoading ? '…' : 'Ask'}
                </button>
              </div>

              <h3 className="h3">Final human disposition</h3>
              <div className="decision-bar">
                <button
                  type="button"
                  className={
                    selectedDecision === 'approve'
                      ? 'btn btn--approve btn--selected'
                      : 'btn btn--approve'
                  }
                  onClick={() => setSelectedDecision('approve')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className={
                    selectedDecision === 'reject'
                      ? 'btn btn--reject btn--selected'
                      : 'btn btn--reject'
                  }
                  onClick={() => setSelectedDecision('reject')}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className={
                    selectedDecision === 'refer_manual_review'
                      ? 'btn btn--refer btn--selected'
                      : 'btn btn--refer'
                  }
                  onClick={() => setSelectedDecision('refer_manual_review')}
                >
                  Refer / Manual review
                </button>
              </div>
              <label className="field">
                <span>Reviewer notes (optional)</span>
                <textarea
                  className="textarea"
                  rows={3}
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  placeholder="Rationale, conditions, or escalation details…"
                />
              </label>
              <div className="actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={
                    !selectedDecision || decisionSubmitting || !applicantPayload
                  }
                  onClick={() => void confirmHumanDisposition()}
                >
                  {decisionSubmitting
                    ? 'Recording…'
                    : 'Confirm final disposition'}
                </button>
              </div>

              {decisionRecorded ? (
                <div className="callout callout--success">
                  <strong>Recorded.</strong> Server log includes the decision
                  snapshot (demo).{' '}
                  <pre className="pre pre--compact">
                    {JSON.stringify(decisionRecorded, null, 2)}
                  </pre>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
