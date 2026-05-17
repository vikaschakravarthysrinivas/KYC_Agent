import OpenAI from 'openai';
import { z, type ZodType } from 'zod';
import {
  toImageDataUrl,
  validateImagePayload,
  type IdCardImageInput,
} from '../imageInput.js';
import { parseModelJson } from '../parseModelJson.js';
import { prepareImageForVision } from '../prepareImageForVision.js';
import {
  formatVisionApiError,
  getFaceImageDetail,
  logVisionImageSizes,
  withVisionTimeout,
} from '../visionUtils.js';

let openaiClient: OpenAI | null = null;

export function getFaceModel(): string {
  return (
    process.env.KYC_FACE_MODEL ??
    process.env.KYC_VISION_MODEL ??
    process.env.KYC_MODEL ??
    'us.anthropic.claude-opus-4-5-20251101-v1:0'
  );
}

export function getFaceTimeoutMs(): number {
  const n = Number(process.env.KYC_FACE_TIMEOUT_MS ?? '120000');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 120_000;
}

function getOpenAIClient(): OpenAI {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.LITELLM_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing LITELLM_API_KEY or OPENAI_API_KEY for face matching.',
    );
  }
  const baseURL =
    process.env.LITELLM_BASE_URL ?? process.env.OPENAI_BASE_URL ?? undefined;
  openaiClient = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });
  return openaiClient;
}

function fieldKeysFromSchema(schema: ZodType): string[] {
  if (schema instanceof z.ZodObject) {
    return Object.keys(schema.shape);
  }
  return [];
}

/**
 * Vision call with json_object response (fast on Bedrock vs large json_schema).
 */
export async function faceVisionJsonCall<T>(options: {
  label: string;
  systemInstructions: string;
  userText: string;
  images: IdCardImageInput[];
  outputSchema: ZodType<T>;
  onProgress?: (message: string) => void;
  maxTokens?: number;
}): Promise<T> {
  const prepared: IdCardImageInput[] = [];
  let beforeBytes = 0;
  for (const img of options.images) {
    validateImagePayload(img);
    beforeBytes += Buffer.from(img.base64, 'base64').length;
    options.onProgress?.('Compressing image for face match…');
    const p = await prepareImageForVision(img);
    prepared.push(p);
  }
  const afterBytes = prepared.reduce(
    (sum, img) => sum + Buffer.from(img.base64, 'base64').length,
    0,
  );
  logVisionImageSizes(options.label, beforeBytes, afterBytes);

  const model = getFaceModel();
  const timeoutMs = getFaceTimeoutMs();
  const imageDetail = getFaceImageDetail();
  options.onProgress?.(
    `Calling ${model} for ${options.label} (${prepared.length} image(s), detail=${imageDetail})…`,
  );

  const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
    { type: 'text', text: options.userText },
  ];
  for (const img of prepared) {
    userContent.push({
      type: 'image_url',
      image_url: { url: toImageDataUrl(img), detail: imageDetail },
    });
  }

  const keys = fieldKeysFromSchema(options.outputSchema);
  const systemContent = `${options.systemInstructions}\n\nReturn **only** a JSON object (no markdown). Keys: ${keys.join(', ')}.`;

  const client = getOpenAIClient();

  const started = Date.now();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  if (options.onProgress) {
    heartbeat = setInterval(() => {
      const elapsed = Math.round((Date.now() - started) / 1000);
      options.onProgress?.(
        `Still waiting on ${options.label} (${elapsed}s, model=${model})…`,
      );
    }, 12_000);
  }

  try {
    const completion = await withVisionTimeout(
      options.label,
      client.chat.completions.create(
        {
          model,
          max_tokens: options.maxTokens ?? 1536,
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent },
          ],
          response_format: { type: 'json_object' },
        },
        { timeout: timeoutMs },
      ),
      timeoutMs,
      'Increase KYC_FACE_TIMEOUT_MS or set KYC_FACE_MODEL to a model your LiteLLM key can access.',
    );
    console.log(`[face] ${options.label} finished in ${Date.now() - started}ms`);

    const raw = completion.choices[0]?.message?.content;
    if (!raw?.trim()) {
      throw new Error(`No response from ${options.label}.`);
    }

    const parsed = parseModelJson(raw);
    const validated = options.outputSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(
        `${options.label} JSON validation failed: ${validated.error.message}`,
      );
    }
    options.onProgress?.(`${options.label} complete.`);
    return validated.data;
  } catch (err) {
    throw new Error(formatVisionApiError(err));
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}
