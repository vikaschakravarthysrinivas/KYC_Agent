import type { IdCardImageInput } from '../imageInput.js';
import type { NormalizedIdCardImages } from '../normalizeIdCardUpload.js';
import { faceMatchCombinedSchema, type FaceBBoxResult, type FaceCompareResult } from './types.js';
import { faceVisionJsonCall } from './faceVisionCall.js';

const COMBINED_PROMPT = `You perform **demo KYC face matching** in one step from two static photos:
- Image 1: Indian ID document (driving licence, passport bio page, or Aadhaar)
- Image 2: Applicant selfie

Tasks:
1. Locate the **primary holder portrait** on image 1 (normalized bbox: x,y top-left 0–1, width, height 0–1). Ignore ghost/hologram faces, QR, signatures.
2. Compare that portrait to image 2 — same person? (NOT true video liveness.)

On a **single combined scan** (front+back side-by-side or stacked, or passport bio+address), bbox only the main holder photo (usually front/bio half).

Output overallStatus: match | likely_match | no_match | unable_to_verify, confidenceScore 0–100, facialFeatureNotes, livenessNotes (state static demo only), recommendation.`;

function idImageTaskText(
  documentTypeLabel: string | undefined,
  uploadMode: NormalizedIdCardImages['uploadMode'] | undefined,
): string {
  const doc = documentTypeLabel ?? 'Indian ID';
  if (uploadMode === 'front_and_back') {
    return `Image 1 is the **front** of the ${doc}. Image 2 is the selfie.`;
  }
  return `Image 1 is a **single scan** of the ${doc} (front only, back only, or front+back combined in one image). Read all visible sides; bbox the holder portrait. Image 2 is the selfie.`;
}

export type DetectAndCompareResult = {
  bbox: FaceBBoxResult;
  compare: FaceCompareResult;
};

/**
 * One vision call for portrait bbox + selfie comparison (avoids 2 extra round-trips vs separate steps).
 */
export async function detectAndCompareFaces(options: {
  idImage: IdCardImageInput;
  selfie: IdCardImageInput;
  documentTypeLabel?: string;
  uploadMode?: NormalizedIdCardImages['uploadMode'];
  applicantName?: string;
  applicantDob?: string;
  onProgress?: (message: string) => void;
}): Promise<DetectAndCompareResult> {
  const context = [
    options.applicantName ? `Applicant name: ${options.applicantName}` : '',
    options.applicantDob ? `Applicant DOB: ${options.applicantDob}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  options.onProgress?.('Detecting ID portrait and comparing to selfie (one vision call)…');

  const combined = await faceVisionJsonCall({
    label: 'Face detect + compare',
    systemInstructions: COMBINED_PROMPT,
    userText: `${idImageTaskText(options.documentTypeLabel, options.uploadMode)}${context ? `\n${context}` : ''}`,
    images: [options.idImage, options.selfie],
    outputSchema: faceMatchCombinedSchema,
    onProgress: options.onProgress,
    maxTokens: 1536,
  });

  const bbox: FaceBBoxResult = {
    faceDetected: combined.faceDetected,
    boundingBox: combined.boundingBox,
    sourceSide: combined.sourceSide,
    notes: combined.bboxNotes,
  };

  const compare: FaceCompareResult = {
    overallStatus: combined.overallStatus,
    confidenceScore: combined.confidenceScore,
    facialFeatureNotes: combined.facialFeatureNotes,
    livenessNotes: combined.livenessNotes,
    recommendation: combined.recommendation,
  };

  return { bbox, compare };
}
