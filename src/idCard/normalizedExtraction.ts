import type { IndiaAadhaarExtraction } from './indiaAadhaar.js';
import type { IndiaDlExtraction } from './indiaDrivingLicense.js';
import type { IndiaPassportExtraction } from './indiaPassport.js';
import { normId } from './normalize.js';

/** Common shape used for form vs ID comparison across document types. */
export type NormalizedIdExtraction = {
  documentType: string;
  fullLegalName: string;
  dateOfBirth?: string;
  idProofNumber?: string;
  idProofNumberAlt?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  country?: string;
  rawAddressBlock?: string;
  validUntil?: string;
  gender?: string;
  extractionNotes?: string;
};

export function normalizeDigitsId(value: string | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

export function fromIndiaDl(raw: IndiaDlExtraction): NormalizedIdExtraction {
  return {
    documentType: raw.documentType || 'India Driving Licence',
    fullLegalName: raw.fullLegalName,
    dateOfBirth: raw.dateOfBirth,
    idProofNumber: raw.licenseNumber,
    idProofNumberAlt: raw.licenseNumberBack,
    addressLine1: raw.addressLine1,
    addressLine2: raw.addressLine2,
    city: raw.city,
    stateRegion: raw.stateRegion,
    postalCode: raw.postalCode,
    country: raw.country ?? 'India',
    rawAddressBlock: raw.rawAddressBlock,
    validUntil: raw.validUntil ?? raw.validUntilTransport,
    extractionNotes: raw.extractionNotes,
  };
}

export function fromIndiaAadhaar(
  raw: IndiaAadhaarExtraction,
): NormalizedIdExtraction {
  const num = raw.aadhaarNumber?.trim();
  return {
    documentType: raw.documentType || 'India Aadhaar',
    fullLegalName: raw.fullLegalName,
    dateOfBirth: raw.dateOfBirth,
    idProofNumber: num,
    addressLine1: raw.addressLine1,
    addressLine2: raw.addressLine2,
    city: raw.city,
    stateRegion: raw.stateRegion,
    postalCode: raw.postalCode,
    country: raw.country ?? 'India',
    rawAddressBlock: raw.rawAddressBlock,
    gender: raw.gender,
    extractionNotes: [
      raw.extractionNotes,
      raw.fatherOrGuardianName
        ? `S/O or C/O: ${raw.fatherOrGuardianName}`
        : undefined,
      raw.virtualId ? `VID: ${raw.virtualId}` : undefined,
    ]
      .filter(Boolean)
      .join('; '),
  };
}

export function fromIndiaPassport(
  raw: IndiaPassportExtraction,
): NormalizedIdExtraction {
  const name =
    raw.fullLegalName?.trim() ||
    [raw.givenNames, raw.surname].filter(Boolean).join(' ').trim();
  return {
    documentType: raw.documentType || 'India Passport',
    fullLegalName: name,
    dateOfBirth: raw.dateOfBirth,
    idProofNumber: raw.passportNumber,
    addressLine1: raw.addressLine1,
    addressLine2: raw.addressLine2,
    city: raw.city,
    stateRegion: raw.stateRegion,
    postalCode: raw.postalCode,
    country: raw.country ?? 'India',
    rawAddressBlock: raw.rawAddressBlock,
    validUntil: raw.dateOfExpiry,
    gender: raw.sex,
    extractionNotes: [
      raw.extractionNotes,
      raw.fatherName ? `Father: ${raw.fatherName}` : undefined,
      raw.placeOfBirth ? `POB: ${raw.placeOfBirth}` : undefined,
    ]
      .filter(Boolean)
      .join('; '),
  };
}

export function idNumbersEquivalent(
  form: string,
  primary: string | undefined,
  alt?: string,
): boolean {
  const f = normId(form);
  const p = normId(primary);
  const a = normId(alt);
  const fd = normalizeDigitsId(form);
  const pd = normalizeDigitsId(primary);
  const ad = normalizeDigitsId(alt);
  if (!f && !p && !a && !fd && !pd) return false;
  if (fd.length >= 12 && pd.length >= 12) {
    return fd === pd || (ad.length >= 12 && fd === ad);
  }
  if (f && (f === p || (a && f === a))) return true;
  if (fd && pd && fd === pd) return true;
  return false;
}
