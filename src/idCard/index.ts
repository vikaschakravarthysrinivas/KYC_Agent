export {
  compareIdToForm,
  type IdCompareFormInput,
  type IdFieldResult,
  type IdVerificationResult,
  type FieldMatchStatus,
} from './compareIdToForm.js';
export {
  NATIONAL_ID_DOCUMENT_TYPES,
  isNationalIdDocumentType,
  isExtractionImplemented,
  nationalIdDocumentTypeLabel,
  type NationalIdDocumentType,
} from './documentTypes.js';
export { extractIndiaAadhaar } from './extractAadhaar.js';
export { extractIndiaDrivingLicense, type ExtractIdCardOptions } from './extractIdCard.js';
export { extractIndiaPassport } from './extractPassport.js';
export {
  extractNationalId,
  type ExtractNationalIdOptions,
  type NationalIdExtraction,
  type NationalIdExtractionResult,
} from './extractNationalId.js';
export {
  extractNationalIdFromForm,
  isSkipIdVisionEnabled,
  type IdFormFields,
} from './extractFromForm.js';
export { getVisionModel } from './runVisionExtraction.js';
export {
  indiaAadhaarExtractionSchema,
  type IndiaAadhaarExtraction,
} from './indiaAadhaar.js';
export {
  indiaDlExtractionSchema,
  type IndiaDlExtraction,
} from './indiaDrivingLicense.js';
export {
  indiaPassportExtractionSchema,
  type IndiaPassportExtraction,
} from './indiaPassport.js';
export {
  type NormalizedIdExtraction,
  fromIndiaAadhaar,
  fromIndiaDl,
  fromIndiaPassport,
} from './normalizedExtraction.js';
export {
  parseDataUrlOrBase64,
  toImageDataUrl,
  validateImagePayload,
  type IdCardImageInput,
} from './imageInput.js';
export {
  normalizeIdCardUpload,
  type NormalizedIdCardImages,
  type RawIdCardUpload,
} from './normalizeIdCardUpload.js';
export {
  runFaceMatch,
  parseSelfieUpload,
  detectIdFaceBox,
  type FaceMatchResult,
  type SelfieUploadInput,
} from './faceMatch/index.js';
