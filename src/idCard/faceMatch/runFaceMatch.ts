import {
  parseDataUrlOrBase64,
  type IdCardImageInput,
} from '../imageInput.js';
import type { NormalizedIdCardImages } from '../normalizeIdCardUpload.js';
import { detectAndCompareFaces } from './detectAndCompareFaces.js';
import { cropIdFace } from './cropIdFace.js';
import type { FaceMatchResult } from './types.js';

export type SelfieUploadInput = {
  imageBase64: string;
  mimeType?: string;
};

export type RunFaceMatchOptions = {
  idFront: IdCardImageInput;
  selfie: SelfieUploadInput;
  documentTypeLabel?: string;
  uploadMode?: NormalizedIdCardImages['uploadMode'];
  applicantName?: string;
  applicantDob?: string;
  onProgress?: (message: string) => void;
  /** Fires after local sharp crop (before full pipeline ends). */
  onFaceCropped?: (previewDataUrl: string) => void;
};

function buildSummaryForAgent(result: FaceMatchResult): string {
  return [
    `Face match (demo static photo comparison): ${result.overallStatus}`,
    `Confidence: ${result.confidenceScore}/100`,
    result.facialFeatureNotes,
    result.livenessNotes ?? 'Not true liveness — static images only.',
    `Recommendation: ${result.recommendation}`,
  ].join('\n');
}

/**
 * One vision call (bbox + compare) → optional local crop for UI preview.
 */
export async function runFaceMatch(
  options: RunFaceMatchOptions,
): Promise<FaceMatchResult> {
  const selfieRaw = options.selfie.imageBase64;
  if (!selfieRaw?.trim()) {
    throw new Error(
      'selfie.imageBase64 is required (base64 string or data URL).',
    );
  }
  const selfie = parseDataUrlOrBase64(selfieRaw, options.selfie.mimeType);

  options.onProgress?.(
    `Starting demo face match (model: ${process.env.KYC_FACE_MODEL ?? process.env.KYC_VISION_MODEL ?? process.env.KYC_MODEL ?? 'default'})…`,
  );

  const { bbox, compare } = await detectAndCompareFaces({
    idImage: options.idFront,
    selfie,
    documentTypeLabel: options.documentTypeLabel,
    uploadMode: options.uploadMode,
    applicantName: options.applicantName,
    applicantDob: options.applicantDob,
    onProgress: options.onProgress,
  });

  let idFacePreviewDataUrl = '';
  if (bbox.faceDetected && bbox.boundingBox) {
    options.onProgress?.('Building ID portrait preview…');
    try {
      const { previewDataUrl } = await cropIdFace(options.idFront, bbox);
      idFacePreviewDataUrl = previewDataUrl;
      options.onFaceCropped?.(previewDataUrl);
    } catch (err) {
      const note =
        err instanceof Error ? err.message : 'Could not crop ID portrait.';
      bbox.notes = [bbox.notes, note].filter(Boolean).join(' ');
    }
  }

  const result: FaceMatchResult = {
    ...compare,
    idFacePreviewDataUrl,
    bbox,
    summaryForAgent: '',
  };
  result.summaryForAgent = buildSummaryForAgent(result);
  options.onProgress?.(
    `Face match done: ${result.overallStatus.replace(/_/g, ' ')} (${result.confidenceScore}/100).`,
  );
  return result;
}

export function parseSelfieUpload(
  raw: SelfieUploadInput,
): IdCardImageInput {
  return parseDataUrlOrBase64(raw.imageBase64, raw.mimeType);
}
