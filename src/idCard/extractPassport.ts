import {
  INDIA_PASSPORT_EXTRACTION_PROMPT,
  indiaPassportExtractionSchema,
  type IndiaPassportExtraction,
} from './indiaPassport.js';
import type { NormalizedIdCardImages } from './normalizeIdCardUpload.js';
import type { VisionImageInput } from './runVisionExtraction.js';
import {
  runVisionStructuredExtraction,
  type VisionProgressCallback,
} from './runVisionExtraction.js';

export type ExtractPassportOptions = VisionImageInput & {
  uploadMode?: NormalizedIdCardImages['uploadMode'];
  onProgress?: VisionProgressCallback;
};

export async function extractIndiaPassport(
  options: ExtractPassportOptions,
): Promise<IndiaPassportExtraction> {
  const { onProgress, uploadMode, ...images } = options;
  const task =
    uploadMode === 'front_and_back' || images.back
      ? 'Image 1 is the passport bio page; image 2 is the address/family page. Merge into one record.'
      : 'Single image: bio page only, address page only, or both pages combined — read all visible fields.';

  return runVisionStructuredExtraction(
    'india-passport',
    'India Passport Extraction',
    INDIA_PASSPORT_EXTRACTION_PROMPT,
    indiaPassportExtractionSchema,
    images,
    task,
    onProgress,
  );
}
