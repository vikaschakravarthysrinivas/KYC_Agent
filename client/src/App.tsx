import { FormEvent, useEffect, useMemo, useState } from 'react';

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

type IdCardFiles = {
  front: File | null;
  back: File | null;
};

type IdExtractionData = Record<string, unknown>;

type KycStreamEvent = {
  type: string;
  message?: string;
  extraction?: IdExtractionData;
  normalized?: IdExtractionData;
  verification?: IdVerificationResult;
  idFacePreview?: string;
  faceMatch?: FaceMatchResult;
  tool?: string;
  result?: {
    report: KycReport;
    applicantPayload: string;
    idExtraction?: IdExtractionData;
    idVerification?: IdVerificationResult;
    faceMatch?: FaceMatchResult;
    idFacePreview?: string;
  };
};

type IdFieldResult = {
  field: string;
  formValue: string;
  idValue: string;
  status: string;
  note?: string;
};

type IdVerificationResult = {
  overallStatus: string;
  fieldResults: IdFieldResult[];
  licenseExpired?: boolean;
  documentExpired?: boolean;
  frontBackDlConflict?: boolean;
};

type FaceMatchResult = {
  overallStatus: string;
  confidenceScore: number;
  facialFeatureNotes: string;
  livenessNotes?: string;
  recommendation: string;
  idFacePreviewDataUrl?: string;
};

async function fileToBase64Payload(
  file: File,
): Promise<{ base64: string; mimeType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
    reader.readAsDataURL(file);
  });
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) throw new Error('Could not encode image.');
  return { base64: m[2]!, mimeType: m[1]! };
}

const KYC_STREAM_TIMEOUT_MS = 180_000;

async function consumeKycStream(
  body: unknown,
  onEvent: (event: KycStreamEvent) => void,
): Promise<void> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    controller.abort();
  }, KYC_STREAM_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch('/api/kyc/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    window.clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        `KYC request timed out after ${KYC_STREAM_TIMEOUT_MS / 1000}s. Check the API terminal for [vision] logs, set KYC_VISION_MODEL=gpt-4o in .env, or use KYC_SKIP_ID_VISION=1.`,
      );
    }
    throw err;
  }
  window.clearTimeout(timeout);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Request failed (${res.status})`);
  }
  if (!res.body) {
    throw new Error('No response body from stream.');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const dataLine = part
        .split('\n')
        .find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      const json = dataLine.slice(5).trim();
      if (!json) continue;
      onEvent(JSON.parse(json) as KycStreamEvent);
    }
  }
}

function fieldStatusClass(status: string): string {
  if (status === 'match') return 'field-status field-status--ok';
  if (status === 'mismatch') return 'field-status field-status--bad';
  if (status === 'partial') return 'field-status field-status--warn';
  return 'field-status';
}

function faceMatchBadgeClass(status: string): string {
  if (status === 'match' || status === 'likely_match') return 'badge badge--ok';
  if (status === 'no_match') return 'badge badge--bad';
  return 'badge badge--review';
}

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

function faceStatusBadgeClass(status: string): string {
  if (status === 'match') return 'badge badge--ok';
  if (status === 'likely_match') return 'badge badge--review';
  if (status === 'no_match') return 'badge badge--bad';
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
  const [idDocumentKind, setIdDocumentKind] = useState(
    'india_driving_licence',
  );
  const [idFiles, setIdFiles] = useState<IdCardFiles>({ front: null, back: null });
  const [idPreview, setIdPreview] = useState<{ front?: string; back?: string }>(
    {},
  );
  const [idExtraction, setIdExtraction] = useState<IdExtractionData | null>(
    null,
  );
  const [idVerification, setIdVerification] =
    useState<IdVerificationResult | null>(null);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | undefined>();
  const [idFacePreview, setIdFacePreview] = useState<string | undefined>();
  const [faceMatch, setFaceMatch] = useState<FaceMatchResult | null>(null);

  const hasIdUpload = Boolean(idFiles.front || idFiles.back);

  useEffect(() => {
    if (!hasIdUpload) {
      setSelfieFile(null);
      setSelfiePreview(undefined);
      setIdFacePreview(undefined);
      setFaceMatch(null);
    }
  }, [hasIdUpload]);

  const canSubmit = useMemo(() => {
    const base =
      form.fullLegalName.trim() &&
      form.dateOfBirth.trim() &&
      form.addressLine1.trim() &&
      form.city.trim() &&
      form.stateRegion.trim() &&
      form.postalCode.trim() &&
      form.country.trim();
    if (!base) return false;
    if (hasIdUpload && !selfieFile) return false;
    return true;
  }, [form, hasIdUpload, selfieFile]);

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
    setIdExtraction(null);
    setIdVerification(null);
    setIdFacePreview(undefined);
    setFaceMatch(null);
    setProgressLog([]);
    setLoading(true);
    try {
      let idCard:
        | {
            documentType: string;
            frontBase64: string;
            frontMimeType: string;
            backBase64?: string;
            backMimeType?: string;
          }
        | undefined;
      if (idFiles.front || idFiles.back) {
        if (idFiles.front) {
          const front = await fileToBase64Payload(idFiles.front);
          idCard = {
            documentType: idDocumentKind,
            frontBase64: front.base64,
            frontMimeType: front.mimeType,
          };
        }
        if (idFiles.back) {
          const back = await fileToBase64Payload(idFiles.back);
          if (idCard) {
            idCard.backBase64 = back.base64;
            idCard.backMimeType = back.mimeType;
          } else {
            // Back-only upload: treat as single combined scan
            idCard = {
              documentType: idDocumentKind,
              frontBase64: back.base64,
              frontMimeType: back.mimeType,
            };
          }
        }
      }

      const requestBody = {
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
        idDocumentType:
          form.idDocumentType ||
          (idCard ? 'India Driving Licence' : undefined),
        idProofNumber: form.idProofNumber || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        documents: {
          applicationForm: form.applicationForm,
          idProof: form.idProof,
          addressProof: form.addressProof,
          selfie: form.selfie,
        },
        idCard,
      };

      if (selfieFile) {
        const selfie = await fileToBase64Payload(selfieFile);
        Object.assign(requestBody, {
          selfie: {
            imageBase64: selfie.base64,
            mimeType: selfie.mimeType,
          },
        });
      }

      await consumeKycStream(requestBody, (event) => {
        if (event.type === 'status' || event.type === 'kyc_progress') {
          const line = event.message ?? event.type;
          setProgressLog((prev) => [...prev, line]);
        }
        if (event.type === 'id_extracted' && event.extraction) {
          setIdExtraction(event.extraction);
          setProgressLog((prev) => [
            ...prev,
            'ID extraction complete — review fields below.',
          ]);
        }
        if (event.type === 'id_compared' && event.verification) {
          setIdVerification(event.verification);
          setProgressLog((prev) => [
            ...prev,
            `Form vs ID comparison: ${event.verification.overallStatus.replace(/_/g, ' ')}`,
          ]);
        }
        if (event.type === 'face_cropped' && event.idFacePreview) {
          setIdFacePreview(event.idFacePreview);
          setProgressLog((prev) => [
            ...prev,
            'Portrait cropped from ID document.',
          ]);
        }
        if (event.type === 'face_compared' && event.faceMatch) {
          setFaceMatch(event.faceMatch);
          setProgressLog((prev) => [
            ...prev,
            `Face match: ${event.faceMatch.overallStatus.replace(/_/g, ' ')} (${event.faceMatch.confidenceScore}/100)`,
          ]);
        }
        if (event.type === 'error') {
          throw new Error(event.message ?? 'KYC stream failed');
        }
        if (event.type === 'complete' && event.result) {
          setReport(event.result.report);
          setApplicantPayload(event.result.applicantPayload ?? null);
          if (event.result.idExtraction) {
            setIdExtraction(event.result.idExtraction);
          }
          if (event.result.idVerification) {
            setIdVerification(event.result.idVerification);
          }
          if (event.result.faceMatch) {
            setFaceMatch(event.result.faceMatch);
          }
          if (event.result.idFacePreview) {
            setIdFacePreview(event.result.idFacePreview);
          }
          setSelectedDecision(event.result.report.recommendation);
        }
      });
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
            Complete the form and optionally upload a national ID image
            (driving licence, Aadhaar, or passport). KYC always checks the demo
            registry; with an upload, extracted fields are compared to your form
            before assessment.
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

            <fieldset className="id-upload">
              <legend>National ID image (optional)</legend>
              <label className="field">
                <span>ID document type for upload</span>
                <select
                  value={idDocumentKind}
                  onChange={(e) => {
                    const kind = e.target.value;
                    setIdDocumentKind(kind);
                    const labels: Record<string, string> = {
                      india_driving_licence: 'India Driving Licence',
                      india_passport: 'India Passport',
                      india_aadhaar: 'India Aadhaar',
                    };
                    if (labels[kind]) {
                      setForm((f) => ({
                        ...f,
                        idDocumentType: labels[kind]!,
                      }));
                    }
                  }}
                >
                  <option value="india_driving_licence">
                    India — Driving licence
                  </option>
                  <option value="india_passport">India — Passport</option>
                  <option value="india_aadhaar">India — Aadhaar</option>
                  <option value="other_national_id" disabled>
                    Other national ID (coming soon)
                  </option>
                </select>
              </label>
              <p className="muted small">
                {idDocumentKind === 'india_passport'
                  ? 'Upload bio page, or one scan with bio + address pages. JPEG, PNG, or WebP, max 8 MB each.'
                  : idDocumentKind === 'india_aadhaar'
                    ? 'Upload front, or one image with front+back stacked. Address is usually on the back.'
                    : 'Use “Front or combined” for one scan (front+back together), or add “Back” as a second file. Either way works.'}
              </p>
              <div className="id-upload__row">
                <label className="field file-field">
                  <span>Front or combined image</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setIdFiles((f) => ({ ...f, front: file }));
                      setIdPreview((p) => ({
                        ...p,
                        front: file ? URL.createObjectURL(file) : undefined,
                      }));
                    }}
                  />
                  {idFiles.front ? (
                    <span className="file-name">{idFiles.front.name}</span>
                  ) : null}
                </label>
                <label className="field file-field">
                  <span>Back (optional)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setIdFiles((f) => ({ ...f, back: file }));
                      setIdPreview((p) => ({
                        ...p,
                        back: file ? URL.createObjectURL(file) : undefined,
                      }));
                    }}
                  />
                  {idFiles.back ? (
                    <span className="file-name">{idFiles.back.name}</span>
                  ) : null}
                </label>
              </div>
              {(idPreview.front || idPreview.back) && (
                <div className="id-preview">
                  {idPreview.front ? (
                    <img src={idPreview.front} alt="ID front preview" />
                  ) : null}
                  {idPreview.back ? (
                    <img src={idPreview.back} alt="ID back preview" />
                  ) : null}
                </div>
              )}
            </fieldset>

            {hasIdUpload ? (
              <fieldset className="id-upload id-upload--selfie">
                <legend>Live selfie (required with ID)</legend>
                <p className="muted small">
                  Demo face match: static photo comparison to the portrait on
                  your ID — not true video liveness.
                </p>
                <label className="field file-field">
                  <span>Selfie / live photo</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    required={hasIdUpload}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setSelfieFile(file);
                      setSelfiePreview(
                        file ? URL.createObjectURL(file) : undefined,
                      );
                      if (file) {
                        setForm((f) => ({ ...f, selfie: true }));
                      }
                    }}
                  />
                  {selfieFile ? (
                    <span className="file-name">{selfieFile.name}</span>
                  ) : (
                    <span className="file-name file-name--warn">
                      Required when ID is uploaded
                    </span>
                  )}
                </label>
                {(selfiePreview || idFacePreview) && (
                  <div className="id-preview face-preview-pair">
                    {idFacePreview ? (
                      <figure>
                        <img src={idFacePreview} alt="Face from ID" />
                        <figcaption>From ID</figcaption>
                      </figure>
                    ) : null}
                    {selfiePreview ? (
                      <figure>
                        <img src={selfiePreview} alt="Your selfie" />
                        <figcaption>Selfie</figcaption>
                      </figure>
                    ) : null}
                  </div>
                )}
              </fieldset>
            ) : null}

            <div className="grid2">
              <label className="field">
                <span>ID document type (form / registry)</span>
                <input
                  value={form.idDocumentType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, idDocumentType: e.target.value }))
                  }
                  placeholder="India Driving Licence, Passport, Aadhaar…"
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

        {loading || progressLog.length > 0 ? (
          <section className="panel panel--progress">
            <h2 className="panel__title">Assessment progress</h2>
            <ul className="progress-log" aria-live="polite">
              {progressLog.map((line, i) => (
                <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
              ))}
              {loading ? <li className="progress-log__active">…</li> : null}
            </ul>
          </section>
        ) : null}

        {idExtraction ? (
          <section className="panel panel--id panel--extract">
            <h2 className="panel__title">Extracted from ID document</h2>
            <p className="panel__hint">
              Vision model output from your upload (before registry KYC).
            </p>
            <pre className="pre pre--compact">
              {JSON.stringify(idExtraction, null, 2)}
            </pre>
          </section>
        ) : null}

        {idVerification ? (
          <section className="panel panel--id">
            <h2 className="panel__title">Form vs ID comparison</h2>
            <p className="panel__hint">
              Deterministic check of your form entries against the extracted ID
              fields.
            </p>
            <p className="ai-row">
              <span className="muted">Overall</span>
              <span
                className={
                  idVerification.overallStatus === 'match'
                    ? 'badge badge--ok'
                    : idVerification.overallStatus === 'mismatch'
                      ? 'badge badge--bad'
                      : 'badge badge--review'
                }
              >
                {idVerification.overallStatus.replace(/_/g, ' ')}
              </span>
            </p>
            {idVerification.documentExpired ?? idVerification.licenseExpired ? (
              <p className="muted small">
                Document appears expired per dates on the ID.
              </p>
            ) : null}
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Form</th>
                  <th>From ID</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {idVerification.fieldResults.map((row) => (
                  <tr key={row.field}>
                    <td>{row.field}</td>
                    <td>{row.formValue || '—'}</td>
                    <td>{row.idValue || '—'}</td>
                    <td>
                      <span className={fieldStatusClass(row.status)}>
                        {row.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {faceMatch ? (
          <section className="panel panel--id panel--face">
            <h2 className="panel__title">Demo face match (selfie vs ID)</h2>
            <p className="panel__hint">
              Static photo comparison — not true video liveness. Used by the KYC
              agent alongside form and registry checks.
            </p>
            <p className="ai-row">
              <span className="muted">Overall</span>
              <span className={faceMatchBadgeClass(faceMatch.overallStatus)}>
                {faceMatch.overallStatus.replace(/_/g, ' ')}
              </span>
              <span className="muted">Confidence</span>
              <span className="badge badge--review">
                {faceMatch.confidenceScore}/100
              </span>
            </p>
            {(idFacePreview || selfiePreview) && (
              <div className="id-preview face-preview-pair">
                {idFacePreview ? (
                  <figure>
                    <img src={idFacePreview} alt="Portrait cropped from ID" />
                    <figcaption>From ID</figcaption>
                  </figure>
                ) : null}
                {selfiePreview ? (
                  <figure>
                    <img src={selfiePreview} alt="Uploaded selfie" />
                    <figcaption>Selfie</figcaption>
                  </figure>
                ) : null}
              </div>
            )}
            <dl className="face-match-details">
              <dt>Facial features</dt>
              <dd className="prose">{faceMatch.facialFeatureNotes}</dd>
              {faceMatch.livenessNotes ? (
                <>
                  <dt>Liveness (demo)</dt>
                  <dd className="prose muted small">{faceMatch.livenessNotes}</dd>
                </>
              ) : null}
              <dt>Recommendation</dt>
              <dd className="prose">{faceMatch.recommendation}</dd>
            </dl>
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
