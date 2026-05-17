import {
  INDIA_DL_EXTRACTION_PROMPT,
  indiaDlExtractionSchema,
  type IndiaDlExtraction,
} from './indiaDrivingLicense.js';
import type { IdCardImageInput } from './imageInput.js';
import type { NormalizedIdCardImages } from './normalizeIdCardUpload.js';
import {
  runVisionStructuredExtraction,
  type VisionProgressCallback,
} from './runVisionExtraction.js';

export type ExtractIdCardOptions = {
  front: IdCardImageInput;
  back?: IdCardImageInput;
  uploadMode?: NormalizedIdCardImages['uploadMode'];
  onProgress?: VisionProgressCallback;
};

function dlExtractionTask(
  uploadMode: NormalizedIdCardImages['uploadMode'] | undefined,
  hasBack: boolean,
): string {
  if (uploadMode === 'front_and_back' || hasBack) {
    return 'Image 1 is the front of the Indian driving licence; image 2 is the back. Merge both into one record (address is often on the back).';
  }
  return 'Single image: may show front only, back only, or front and back combined (side-by-side or stacked). Read every visible field on all sides.';
}

export async function extractIndiaDrivingLicense(
  options: ExtractIdCardOptions,
): Promise<IndiaDlExtraction> {
  const { onProgress, uploadMode, ...images } = options;
  const task = dlExtractionTask(uploadMode, Boolean(images.back));

  return runVisionStructuredExtraction(
    'india-dl',
    'India DL Extraction',
    INDIA_DL_EXTRACTION_PROMPT,
    indiaDlExtractionSchema,
    images,
    task,
    onProgress,
  );
}
