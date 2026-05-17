import type { NationalIdDocumentType } from './documentTypes.js';
import type { IndiaAadhaarExtraction } from './indiaAadhaar.js';
import type { IndiaDlExtraction } from './indiaDrivingLicense.js';
import type { IndiaPassportExtraction } from './indiaPassport.js';
import {
  fromIndiaAadhaar,
  fromIndiaDl,
  fromIndiaPassport,
  type NormalizedIdExtraction,
} from './normalizedExtraction.js';
import type { NationalIdExtractionResult } from './extractNationalId.js';

const DOC_LABELS: Record<NationalIdDocumentType, string> = {
  india_driving_licence: 'India Driving Licence',
  india_aadhaar: 'India Aadhaar',
  india_passport: 'India Passport',
  other_national_id: 'Other National ID',
};

/** Applicant fields used when skipping vision (mirrors KycFormInput). */
export type IdFormFields = {
  fullLegalName: string;
  dateOfBirth: string;
  nationality?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  idDocumentType?: string;
  idProofNumber?: string;
};

function baseNormalized(
  form: IdFormFields,
  documentType: NationalIdDocumentType,
): NormalizedIdExtraction {
  return {
    documentType:
      form.idDocumentType?.trim() || DOC_LABELS[documentType],
    fullLegalName: form.fullLegalName,
    dateOfBirth: form.dateOfBirth,
    idProofNumber: form.idProofNumber,
    addressLine1: form.addressLine1,
    addressLine2: form.addressLine2,
    city: form.city,
    stateRegion: form.stateRegion,
    postalCode: form.postalCode,
    country: form.country,
    extractionNotes:
      'Demo fast path: KYC_SKIP_ID_VISION=1 — used form fields instead of vision OCR.',
  };
}

/**
 * Builds ID extraction from the applicant form (no vision API). Use when the form
 * already matches the card and you want registry + KYC only.
 */
export function extractNationalIdFromForm(
  form: IdFormFields,
  documentType: NationalIdDocumentType,
): NationalIdExtractionResult {
  const normalized = baseNormalized(form, documentType);
  const label = normalized.documentType;

  switch (documentType) {
    case 'india_driving_licence': {
      const raw: IndiaDlExtraction = {
        documentType: label,
        fullLegalName: form.fullLegalName,
        dateOfBirth: form.dateOfBirth,
        licenseNumber: form.idProofNumber ?? '',
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2,
        city: form.city,
        stateRegion: form.stateRegion,
        postalCode: form.postalCode,
        country: form.country,
        vehicleClasses: undefined,
        extractionNotes: normalized.extractionNotes,
      };
      return {
        documentKind: documentType,
        raw,
        normalized: fromIndiaDl(raw),
      };
    }
    case 'india_aadhaar': {
      const raw: IndiaAadhaarExtraction = {
        documentType: label,
        fullLegalName: form.fullLegalName,
        dateOfBirth: form.dateOfBirth,
        aadhaarNumber: form.idProofNumber ?? '',
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2,
        city: form.city,
        stateRegion: form.stateRegion,
        postalCode: form.postalCode,
        country: form.country,
        extractionNotes: normalized.extractionNotes,
      };
      return {
        documentKind: documentType,
        raw,
        normalized: fromIndiaAadhaar(raw),
      };
    }
    case 'india_passport': {
      const raw: IndiaPassportExtraction = {
        documentType: label,
        passportNumber: form.idProofNumber ?? '',
        fullLegalName: form.fullLegalName,
        dateOfBirth: form.dateOfBirth,
        nationality: form.nationality ?? 'Indian',
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2,
        city: form.city,
        stateRegion: form.stateRegion,
        postalCode: form.postalCode,
        country: form.country,
        extractionNotes: normalized.extractionNotes,
      };
      return {
        documentKind: documentType,
        raw,
        normalized: fromIndiaPassport(raw),
      };
    }
    default:
      throw new Error(`Form-only extraction not supported for ${documentType}.`);
  }
}

export function isSkipIdVisionEnabled(): boolean {
  const v = (process.env.KYC_SKIP_ID_VISION ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
