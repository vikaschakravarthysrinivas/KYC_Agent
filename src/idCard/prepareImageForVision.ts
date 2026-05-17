import sharp from 'sharp';
import type { IdCardImageInput } from './imageInput.js';

/** Bedrock/Anthropic vision limit is 5 MB; stay under with margin. */
const MAX_BYTES = 4.5 * 1024 * 1024;
const MAX_LONG_EDGE = 2048;

/**
 * Downscales and re-encodes ID images so vision APIs accept them quickly.
 * Large passport scans often exceed provider limits and slow requests.
 */
export async function prepareImageForVision(
  img: IdCardImageInput,
): Promise<IdCardImageInput> {
  const input = Buffer.from(img.base64, 'base64');
  if (input.length === 0) {
    throw new Error('Invalid or empty image data.');
  }

  let pipeline = sharp(input, { failOn: 'none' }).rotate();
  const meta = await pipeline.metadata();
  const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);

  if (longEdge > MAX_LONG_EDGE) {
    pipeline = pipeline.resize(MAX_LONG_EDGE, MAX_LONG_EDGE, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  let quality = 82;
  let out = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();

  while (out.length > MAX_BYTES && quality > 45) {
    quality -= 12;
    out = await sharp(out).jpeg({ quality, mozjpeg: true }).toBuffer();
  }

  if (out.length > MAX_BYTES) {
    out = await sharp(out)
      .resize(1400, 1400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70, mozjpeg: true })
      .toBuffer();
  }

  return {
    base64: out.toString('base64'),
    mimeType: 'image/jpeg',
  };
}

export async function prepareImagesForVision(
  images: { front: IdCardImageInput; back?: IdCardImageInput },
): Promise<{ front: IdCardImageInput; back?: IdCardImageInput }> {
  const front = await prepareImageForVision(images.front);
  const back = images.back
    ? await prepareImageForVision(images.back)
    : undefined;
  return { front, back };
}
