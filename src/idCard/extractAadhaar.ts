import {
  INDIA_AADHAAR_EXTRACTION_PROMPT,
  indiaAadhaarExtractionSchema,
  type IndiaAadhaarExtraction,
} from './indiaAadhaar.js';
import type { NormalizedIdCardImages } from './normalizeIdCardUpload.js';
import type { VisionImageInput } from './runVisionExtraction.js';
import {
  runVisionStructuredExtraction,
  type VisionProgressCallback,
} from './runVisionExtraction.js';

export type ExtractAadhaarOptions = VisionImageInput & {
  uploadMode?: NormalizedIdCardImages['uploadMode'];
  onProgress?: VisionProgressCallback;
};

export async function extractIndiaAadhaar(
  options: ExtractAadhaarOptions,
): Promise<IndiaAadhaarExtraction> {
  const { onProgress, uploadMode, ...images } = options;
  const task =
    uploadMode === 'front_and_back' || images.back
      ? 'Image 1 is the Aadhaar front; image 2 is the back. Merge into one record.'
      : 'Single image: front only, back only, or front+back in one scan — read all visible sides.';

  return runVisionStructuredExtraction(
    'india-aadhaar',
    'India Aadhaar Extraction',
    INDIA_AADHAAR_EXTRACTION_PROMPT,
    indiaAadhaarExtractionSchema,
    images,
    task,
    onProgress,
  );
}
