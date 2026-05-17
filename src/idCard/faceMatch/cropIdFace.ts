import sharp from 'sharp';
import {
  toImageDataUrl,
  type IdCardImageInput,
} from '../imageInput.js';
import type { FaceBBoxResult } from './types.js';
import type { CroppedIdFace } from './types.js';

const PADDING_RATIO = 0.08;

/**
 * Crops the portrait from an ID image using a normalized bounding box.
 */
export async function cropIdFace(
  idImage: IdCardImageInput,
  bbox: FaceBBoxResult,
): Promise<CroppedIdFace> {
  if (!bbox.faceDetected || !bbox.boundingBox) {
    throw new Error(
      bbox.notes?.trim() ||
        'No face detected on the ID document — cannot crop portrait for face match.',
    );
  }

  const input = Buffer.from(idImage.base64, 'base64');
  const meta = await sharp(input).metadata();
  const imgW = meta.width ?? 0;
  const imgH = meta.height ?? 0;
  if (imgW < 8 || imgH < 8) {
    throw new Error('Invalid ID image dimensions for face crop.');
  }

  const { x, y, width, height } = bbox.boundingBox;
  let left = Math.floor(x * imgW);
  let top = Math.floor(y * imgH);
  let w = Math.ceil(width * imgW);
  let h = Math.ceil(height * imgH);

  const padX = Math.floor(w * PADDING_RATIO);
  const padY = Math.floor(h * PADDING_RATIO);
  left = Math.max(0, left - padX);
  top = Math.max(0, top - padY);
  w = Math.min(imgW - left, w + padX * 2);
  h = Math.min(imgH - top, h + padY * 2);

  if (w < 16 || h < 16) {
    throw new Error('Face crop region too small — check bounding box.');
  }

  const cropped = await sharp(input)
    .extract({ left, top, width: w, height: h })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  const crop: IdCardImageInput = {
    base64: cropped.toString('base64'),
    mimeType: 'image/jpeg',
  };

  return {
    crop,
    previewDataUrl: toImageDataUrl(crop),
  };
}
