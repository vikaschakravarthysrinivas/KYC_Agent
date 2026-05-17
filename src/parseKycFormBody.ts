import { normalizeIdCardUpload } from './idCard/normalizeIdCardUpload.js';
import type { IdCardUploadInput, KycFormInput } from './kycEngine.js';

export type ParseKycFormOptions = {
  /** When true (default), ID upload requires a selfie image. */
  requireSelfieWithId?: boolean;
};

export function parseKycFormBody(
  body: Partial<KycFormInput> & {
    documents?: KycFormInput['documents'];
    idCard?: IdCardUploadInput;
    selfie?: KycFormInput['selfie'];
  },
  options?: ParseKycFormOptions,
): { ok: true; form: KycFormInput } | { ok: false; error: string } {
  const requireSelfieWithId = options?.requireSelfieWithId !== false;
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
    return {
      ok: false,
      error: `Missing required fields: ${missing.join(', ')}`,
    };
  }

  const normalizedId = normalizeIdCardUpload(body.idCard);

  if (requireSelfieWithId && normalizedId) {
    const selfieRaw = body.selfie?.imageBase64?.trim();
    if (!selfieRaw) {
      return {
        ok: false,
        error:
          'A live selfie image is required when an ID document image is uploaded.',
      };
    }
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
    idCard: normalizedId
      ? ({
          documentType: normalizedId.documentType,
          frontBase64: normalizedId.front.base64,
          frontMimeType: normalizedId.front.mimeType,
          backBase64: normalizedId.back?.base64,
          backMimeType: normalizedId.back?.mimeType,
        } satisfies IdCardUploadInput)
      : undefined,
    selfie: body.selfie?.imageBase64?.trim()
      ? {
          imageBase64: String(body.selfie.imageBase64),
          mimeType: body.selfie.mimeType
            ? String(body.selfie.mimeType)
            : undefined,
        }
      : undefined,
  };

  return { ok: true, form };
}
