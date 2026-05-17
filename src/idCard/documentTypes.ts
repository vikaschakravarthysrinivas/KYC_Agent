/**
 * National ID document kinds supported by KYC extraction (extensible).
 * Driving licence, Aadhaar, and passport extraction are implemented.
 */
export const NATIONAL_ID_DOCUMENT_TYPES = [
  'india_driving_licence',
  'india_passport',
  'india_aadhaar',
  'other_national_id',
] as const;

export type NationalIdDocumentType = (typeof NATIONAL_ID_DOCUMENT_TYPES)[number];

export function isNationalIdDocumentType(
  value: string,
): value is NationalIdDocumentType {
  return (NATIONAL_ID_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function nationalIdDocumentTypeLabel(type: NationalIdDocumentType): string {
  switch (type) {
    case 'india_driving_licence':
      return 'India — Driving licence';
    case 'india_passport':
      return 'India — Passport';
    case 'india_aadhaar':
      return 'India — Aadhaar';
    case 'other_national_id':
      return 'Other national ID';
    default:
      return type;
  }
}

export function isExtractionImplemented(type: NationalIdDocumentType): boolean {
  return (
    type === 'india_driving_licence' ||
    type === 'india_aadhaar' ||
    type === 'india_passport'
  );
}
