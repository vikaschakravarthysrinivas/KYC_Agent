import type { IdCardImageInput } from '../imageInput.js';
import { faceBBoxSchema, type FaceBBoxResult } from './types.js';
import { faceVisionJsonCall } from './faceVisionCall.js';

const FACE_BBOX_PROMPT = `You locate the **primary portrait photograph** on an Indian identity document image (driving licence, passport bio page, or Aadhaar front).

Rules:
- Return normalized bounding box as fractions of image size: x,y = top-left corner (0–1), width, height (0–1).
- Target the main colour portrait of the document holder (largest face photo).
- **Ignore** ghost/hologram faces, signatures, QR codes, emblems, and small decorative images.
- On a **combined scan** (front+back side-by-side or stacked), bbox only the holder portrait (usually on the front/bio half).
- If no face is visible, set faceDetected=false and omit boundingBox.
- sourceSide: brief note (e.g. "front", "left_half_of_combined_scan").`;

export async function detectIdFaceBox(
  idImage: IdCardImageInput,
  documentTypeLabel?: string,
  onProgress?: (message: string) => void,
): Promise<FaceBBoxResult> {
  onProgress?.('Detecting face on ID document…');
  return faceVisionJsonCall({
    label: 'ID face detection',
    systemInstructions: FACE_BBOX_PROMPT,
    userText: `Find the holder portrait bounding box on this ${documentTypeLabel ?? 'Indian ID'} image.`,
    images: [idImage],
    outputSchema: faceBBoxSchema,
    onProgress,
  });
}
