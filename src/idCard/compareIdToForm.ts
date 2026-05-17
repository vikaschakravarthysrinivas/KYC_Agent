import type { NormalizedIdExtraction } from './normalizedExtraction.js';
import {
  idNumbersEquivalent,
  normalizeDigitsId,
} from './normalizedExtraction.js';
import {
  dobsEquivalent,
  nameOverlapScore,
  norm,
  normalizeDobToIso,
} from './normalize.js';

export type IdCompareFormInput = {
  fullLegalName: string;
  dateOfBirth: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  idProofNumber?: string;
};

export type FieldMatchStatus =
  | 'match'
  | 'mismatch'
  | 'partial'
  | 'missing_on_form'
  | 'missing_on_id'
  | 'not_compared';

export type IdFieldResult = {
  field: string;
  formValue: string;
  idValue: string;
  status: FieldMatchStatus;
  note?: string;
};

export type IdVerificationResult = {
  overallStatus: 'match' | 'partial_match' | 'mismatch' | 'unable_to_verify';
  fieldResults: IdFieldResult[];
  summaryForAgent: string;
  /** @deprecated Use documentExpired */
  licenseExpired: boolean;
  documentExpired: boolean;
  /** @deprecated DL-only; use idNumberConflict */
  frontBackDlConflict: boolean;
  idNumberConflict: boolean;
};

function statusFromScore(
  score: number,
  hasForm: boolean,
  hasId: boolean,
): FieldMatchStatus {
  if (!hasForm && hasId) return 'missing_on_form';
  if (hasForm && !hasId) return 'missing_on_id';
  if (!hasForm && !hasId) return 'not_compared';
  if (score >= 0.92) return 'match';
  if (score >= 0.55) return 'partial';
  return 'mismatch';
}

function compareName(form: string, id: string): FieldMatchStatus {
  const score = nameOverlapScore(form, id);
  return statusFromScore(score, !!form.trim(), !!id.trim());
}

function compareDob(form: string, id: string): FieldMatchStatus {
  if (!form.trim() && id.trim()) return 'missing_on_form';
  if (form.trim() && !id.trim()) return 'missing_on_id';
  if (!form.trim() && !id.trim()) return 'not_compared';
  return dobsEquivalent(form, id) ? 'match' : 'mismatch';
}

function compareIdNumber(
  form: string,
  primary: string | undefined,
  alt?: string,
): FieldMatchStatus {
  if (!form.trim() && (primary?.trim() || alt?.trim())) return 'missing_on_form';
  if (form.trim() && !primary?.trim() && !alt?.trim()) return 'missing_on_id';
  if (!form.trim() && !primary?.trim()) return 'not_compared';
  if (idNumbersEquivalent(form, primary, alt)) return 'match';
  const score = nameOverlapScore(
    norm(form),
    norm([primary, alt].filter(Boolean).join(' ')),
  );
  return statusFromScore(score, true, true);
}

function compareText(form: string, id: string): FieldMatchStatus {
  const a = norm(form);
  const b = norm(id);
  if (!a && b) return 'missing_on_form';
  if (a && !b) return 'missing_on_id';
  if (!a && !b) return 'not_compared';
  if (a === b) return 'match';
  if (a.includes(b) || b.includes(a)) return 'partial';
  const tokensA = new Set(a.split(/\s+/));
  const tokensB = new Set(b.split(/\s+/));
  let hit = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) hit += 1;
  }
  const score = hit / Math.max(tokensA.size, tokensB.size);
  return statusFromScore(score, true, true);
}

function parseExpiry(isoOrRaw: string | undefined): Date | null {
  const iso = normalizeDobToIso(isoOrRaw);
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildSummary(
  result: Omit<IdVerificationResult, 'summaryForAgent'>,
  documentType: string,
): string {
  const lines: string[] = [
    `Document: ${documentType}`,
    `Overall ID vs form status: ${result.overallStatus}`,
    `Document expired (per valid-until / expiry on ID): ${result.documentExpired ? 'yes' : 'no'}`,
    `Alternate ID number on document: ${result.idNumberConflict ? 'yes' : 'no'}`,
    'Field comparison:',
  ];
  for (const f of result.fieldResults) {
    if (f.status === 'not_compared') continue;
    lines.push(
      `- ${f.field}: ${f.status}${f.note ? ` (${f.note})` : ''} | form="${f.formValue || '—'}" | id="${f.idValue || '—'}"`,
    );
  }
  return lines.join('\n');
}

export function compareIdToForm(
  form: IdCompareFormInput,
  extracted: NormalizedIdExtraction,
): IdVerificationResult {
  const idAddr =
    extracted.rawAddressBlock ??
    [extracted.addressLine1, extracted.addressLine2]
      .filter(Boolean)
      .join(', ');
  const formAddr = [form.addressLine1, form.addressLine2]
    .filter(Boolean)
    .join(', ');

  const alt = extracted.idProofNumberAlt?.trim();
  const idNumberConflict =
    !!alt &&
    !!extracted.idProofNumber?.trim() &&
    normalizeDigitsId(extracted.idProofNumber) !== normalizeDigitsId(alt) &&
    norm(extracted.idProofNumber) !== norm(alt);

  const expiry = parseExpiry(extracted.validUntil);
  const documentExpired = expiry != null && expiry < new Date();

  const fieldResults: IdFieldResult[] = [
    {
      field: 'fullLegalName',
      formValue: form.fullLegalName,
      idValue: extracted.fullLegalName ?? '',
      status: compareName(form.fullLegalName, extracted.fullLegalName ?? ''),
    },
    {
      field: 'dateOfBirth',
      formValue: form.dateOfBirth,
      idValue: extracted.dateOfBirth ?? '',
      status: compareDob(form.dateOfBirth, extracted.dateOfBirth ?? ''),
    },
    {
      field: 'idProofNumber',
      formValue: form.idProofNumber ?? '',
      idValue: extracted.idProofNumber ?? '',
      status: compareIdNumber(
        form.idProofNumber ?? '',
        extracted.idProofNumber,
        alt,
      ),
      ...(idNumberConflict ? { note: `Alternate on document: ${alt}` } : {}),
    },
    {
      field: 'address',
      formValue: formAddr,
      idValue: idAddr,
      status: compareText(formAddr, idAddr),
    },
    {
      field: 'city',
      formValue: form.city,
      idValue: extracted.city ?? '',
      status: compareText(form.city, extracted.city ?? ''),
    },
    {
      field: 'stateRegion',
      formValue: form.stateRegion,
      idValue: extracted.stateRegion ?? '',
      status: compareText(form.stateRegion, extracted.stateRegion ?? ''),
    },
    {
      field: 'postalCode',
      formValue: form.postalCode,
      idValue: extracted.postalCode ?? '',
      status: compareText(
        form.postalCode.replace(/\s/g, ''),
        (extracted.postalCode ?? '').replace(/\s/g, ''),
      ),
    },
  ];

  const critical = fieldResults.filter((f) =>
    ['fullLegalName', 'dateOfBirth', 'idProofNumber'].includes(f.field),
  );
  const hasMismatch = critical.some((f) => f.status === 'mismatch');
  const hasPartial = fieldResults.some((f) => f.status === 'partial');
  const missingCritical = critical.some(
    (f) => f.status === 'missing_on_id' || f.status === 'missing_on_form',
  );

  let overallStatus: IdVerificationResult['overallStatus'];
  if (missingCritical && !extracted.fullLegalName) {
    overallStatus = 'unable_to_verify';
  } else if (hasMismatch || documentExpired) {
    overallStatus = 'mismatch';
  } else if (hasPartial || idNumberConflict) {
    overallStatus = 'partial_match';
  } else if (
    critical.every((f) => f.status === 'match' || f.status === 'not_compared')
  ) {
    overallStatus = 'match';
  } else {
    overallStatus = 'partial_match';
  }

  const base = {
    overallStatus,
    fieldResults,
    documentExpired,
    licenseExpired: documentExpired,
    idNumberConflict,
    frontBackDlConflict: idNumberConflict,
  };

  return {
    ...base,
    summaryForAgent: buildSummary(base, extracted.documentType),
  };
}
