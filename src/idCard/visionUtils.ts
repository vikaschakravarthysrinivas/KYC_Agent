export function getVisionTimeoutMs(): number {
  const n = Number(process.env.KYC_VISION_TIMEOUT_MS ?? '120000');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 120_000;
}

export function getVisionImageDetail(): 'low' | 'auto' | 'high' {
  const d = (process.env.KYC_VISION_IMAGE_DETAIL ?? 'auto').toLowerCase();
  if (d === 'low' || d === 'high') return d;
  return 'auto';
}

/** Face match defaults to low detail for speed unless overridden. */
export function getFaceImageDetail(): 'low' | 'auto' | 'high' {
  const d = (process.env.KYC_FACE_IMAGE_DETAIL ?? 'low').toLowerCase();
  if (d === 'auto' || d === 'high') return d;
  return 'low';
}

export function formatVisionApiError(err: unknown): string {
  if (err instanceof Error) {
    const nested = (err as Error & { error?: { message?: string } }).error
      ?.message;
    const msg = nested?.trim() || err.message;
    if (msg.includes('image exceeds 5 MB') || msg.includes('5242880')) {
      return `${msg}\n\nThe vision API rejected the image size. Restart \`npm run dev\` so server-side compression (sharp) runs, or use a smaller JPEG.`;
    }
    if (
      msg.includes('not allowed to access model') ||
      msg.includes('Tried to access')
    ) {
      return `${msg}\n\nYour LiteLLM key cannot call that model. Remove or comment out KYC_VISION_MODEL / KYC_FACE_MODEL in .env so OCR and face match use KYC_MODEL, or set them to a model id your key is allowed to use.`;
    }
    if (msg.includes('timed out')) {
      if (msg.toLowerCase().includes('face')) {
        return `${msg}\n\nIncrease KYC_FACE_TIMEOUT_MS or use a faster vision model your key can access.`;
      }
      return `${msg}\n\nIncrease KYC_VISION_TIMEOUT_MS, use a faster vision model your key can access, or KYC_SKIP_ID_VISION=1 to skip OCR.`;
    }
    return msg;
  }
  return String(err);
}

export async function withVisionTimeout<T>(
  label: string,
  promise: Promise<T>,
  timeoutMs = getVisionTimeoutMs(),
  timeoutHint?: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const hint =
    timeoutHint ??
    'Set KYC_VISION_MODEL=gpt-4o or increase KYC_VISION_TIMEOUT_MS.';
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `${label} timed out after ${Math.round(timeoutMs / 1000)}s (model may be slow or unavailable). ${hint}`,
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function logVisionImageSizes(
  label: string,
  beforeBytes: number,
  afterBytes: number,
): void {
  console.log(
    `[vision] ${label}: image ${Math.round(beforeBytes / 1024)} KB → ${Math.round(afterBytes / 1024)} KB (model=${process.env.KYC_VISION_MODEL ?? process.env.KYC_MODEL ?? 'default'})`,
  );
}
