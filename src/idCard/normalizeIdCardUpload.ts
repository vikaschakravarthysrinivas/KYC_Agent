import type { NationalIdDocumentType } from './documentTypes.js';
import { isNationalIdDocumentType } from './documentTypes.js';
import {
  parseDataUrlOrBase64,
  type IdCardImageInput,
} from './imageInput.js';

export type RawIdCardUpload = {
  documentType?: string;
  frontBase64?: string;
  frontMimeType?: string;
  backBase64?: string;
  backMimeType?: string;
};

export type NormalizedIdCardImages = {
  documentType: NationalIdDocumentType;
  front: IdCardImageInput;
  back?: IdCardImageInput;
  /** One combined scan, or separate front + back files. */
  uploadMode: 'single' | 'front_and_back';
};

/**
 * Accepts front only, back only (treated as single combined scan), or both.
 * Never requires both files.
 */
export function normalizeIdCardUpload(
  raw: RawIdCardUpload | undefined,
): NormalizedIdCardImages | null {
  if (!raw) return null;

  const frontRaw = raw.frontBase64?.trim();
  const backRaw = raw.backBase64?.trim();
  if (!frontRaw && !backRaw) return null;

  const docType =
    raw.documentType && isNationalIdDocumentType(raw.documentType)
      ? raw.documentType
      : 'india_driving_licence';

  if (frontRaw && backRaw) {
    return {
      documentType: docType,
      front: parseDataUrlOrBase64(frontRaw, raw.frontMimeType),
      back: parseDataUrlOrBase64(backRaw, raw.backMimeType),
      uploadMode: 'front_and_back',
    };
  }

  const singleRaw = frontRaw ?? backRaw!;
  const mimeHint = frontRaw ? raw.frontMimeType : raw.backMimeType;
  return {
    documentType: docType,
    front: parseDataUrlOrBase64(singleRaw, mimeHint),
    uploadMode: 'single',
  };
}
