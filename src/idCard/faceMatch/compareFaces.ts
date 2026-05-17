import type { IdCardImageInput } from '../imageInput.js';
import { faceCompareSchema, type FaceCompareResult } from './types.js';
import { faceVisionJsonCall } from './faceVisionCall.js';

const FACE_COMPARE_PROMPT = `You compare two **static photographs** for KYC demo face matching:
- Image 1: portrait cropped from an Indian ID document
- Image 2: live selfie submitted by the applicant

This is **NOT** true liveness detection (no video, blink, or depth). Judge whether the same person likely appears in both photos.

Consider: facial structure, apparent age vs stated DOB if provided, skin tone, distinctive features. Allow for lighting, angle, glasses, beard, or hairstyle changes.

Output:
- overallStatus: match | likely_match | no_match | unable_to_verify
- confidenceScore: 0–100
- facialFeatureNotes: concise evidence
- livenessNotes: state demo limitation (static images only)
- recommendation: one sentence for KYC reviewer`;

export async function compareFaces(options: {
  idFaceCrop: IdCardImageInput;
  selfie: IdCardImageInput;
  applicantName?: string;
  applicantDob?: string;
  onProgress?: (message: string) => void;
}): Promise<FaceCompareResult> {
  const context = [
    options.applicantName ? `Applicant name: ${options.applicantName}` : '',
    options.applicantDob ? `Applicant DOB: ${options.applicantDob}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  options.onProgress?.('Comparing selfie to ID portrait…');

  return faceVisionJsonCall({
    label: 'Face comparison',
    systemInstructions: FACE_COMPARE_PROMPT,
    userText: `Compare image 1 (ID portrait) with image 2 (selfie).${context ? `\n${context}` : ''}`,
    images: [options.idFaceCrop, options.selfie],
    outputSchema: faceCompareSchema,
    onProgress: options.onProgress,
  });
}
