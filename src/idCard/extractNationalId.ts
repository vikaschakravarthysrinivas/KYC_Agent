import type { NationalIdDocumentType } from './documentTypes.js';
import { isExtractionImplemented } from './documentTypes.js';
import { extractIndiaAadhaar } from './extractAadhaar.js';
import type { ExtractIdCardOptions } from './extractIdCard.js';
import type { NormalizedIdCardImages } from './normalizeIdCardUpload.js';
import type { VisionProgressCallback } from './runVisionExtraction.js';
import { extractIndiaDrivingLicense } from './extractIdCard.js';
import { extractIndiaPassport } from './extractPassport.js';
import type { IndiaAadhaarExtraction } from './indiaAadhaar.js';
import type { IndiaDlExtraction } from './indiaDrivingLicense.js';
import type { IndiaPassportExtraction } from './indiaPassport.js';
import {
  fromIndiaAadhaar,
  fromIndiaDl,
  fromIndiaPassport,
  type NormalizedIdExtraction,
} from './normalizedExtraction.js';

export type NationalIdExtraction =
  | IndiaDlExtraction
  | IndiaAadhaarExtraction
  | IndiaPassportExtraction;

export type NationalIdExtractionResult = {
  documentKind: NationalIdDocumentType;
  raw: NationalIdExtraction;
  normalized: NormalizedIdExtraction;
};

export type ExtractNationalIdOptions = ExtractIdCardOptions & {
  documentType: NationalIdDocumentType;
  uploadMode?: NormalizedIdCardImages['uploadMode'];
  onProgress?: VisionProgressCallback;
};

export async function extractNationalId(
  options: ExtractNationalIdOptions,
): Promise<NationalIdExtractionResult> {
  const { documentType, uploadMode, onProgress, ...images } = options;
  const visionOpts = { ...images, uploadMode, onProgress };

  if (!isExtractionImplemented(documentType)) {
    throw new Error(
      `Extraction for "${documentType}" is not implemented yet.`,
    );
  }

  switch (documentType) {
    case 'india_driving_licence': {
      const raw = await extractIndiaDrivingLicense(visionOpts);
      return {
        documentKind: documentType,
        raw,
        normalized: fromIndiaDl(raw),
      };
    }
    case 'india_aadhaar': {
      const raw = await extractIndiaAadhaar(visionOpts);
      return {
        documentKind: documentType,
        raw,
        normalized: fromIndiaAadhaar(raw),
      };
    }
    case 'india_passport': {
      const raw = await extractIndiaPassport(visionOpts);
      return {
        documentKind: documentType,
        raw,
        normalized: fromIndiaPassport(raw),
      };
    }
    default:
      throw new Error(`Unsupported document type: ${documentType}`);
  }
}
