const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const MAX_BYTES = 8 * 1024 * 1024;

export type IdCardImageInput = {
  base64: string;
  mimeType: string;
};

export function parseDataUrlOrBase64(
  raw: string,
  mimeHint?: string,
): IdCardImageInput {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Empty image data.');
  }

  const dataUrl = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
  if (dataUrl) {
    const mimeType = dataUrl[1]!.toLowerCase();
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new Error(`Unsupported image type: ${mimeType}`);
    }
    return { base64: dataUrl[2]!, mimeType };
  }

  const mimeType = (mimeHint ?? 'image/jpeg').toLowerCase();
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new Error(`Unsupported image type: ${mimeType}`);
  }
  return { base64: trimmed, mimeType };
}

export function toImageDataUrl(img: IdCardImageInput): string {
  return `data:${img.mimeType};base64,${img.base64}`;
}

export function validateImagePayload(img: IdCardImageInput): void {
  if (!ALLOWED_MIME.has(img.mimeType)) {
    throw new Error(`Unsupported image type: ${img.mimeType}`);
  }
  const buf = Buffer.from(img.base64, 'base64');
  if (buf.length === 0) throw new Error('Invalid or empty image data.');
  if (buf.length > MAX_BYTES) {
    throw new Error(
      `Image too large (${Math.round(buf.length / 1024)} KB). Max ${MAX_BYTES / 1024 / 1024} MB.`,
    );
  }
}
