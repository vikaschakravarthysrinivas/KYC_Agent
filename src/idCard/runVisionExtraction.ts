import OpenAI from 'openai';
import { z } from 'zod';
import { toJSONSchema } from 'zod/v4';
import {
  toImageDataUrl,
  validateImagePayload,
  type IdCardImageInput,
} from './imageInput.js';
import { parseModelJson } from './parseModelJson.js';
import { prepareImagesForVision } from './prepareImageForVision.js';
import {
  formatVisionApiError,
  getVisionImageDetail,
  getVisionTimeoutMs,
  logVisionImageSizes,
  withVisionTimeout,
} from './visionUtils.js';

export type VisionProgressCallback = (message: string) => void;

export function getVisionModel(): string {
  return (
    process.env.KYC_VISION_MODEL ??
    process.env.KYC_MODEL ??
    'us.anthropic.claude-opus-4-5-20251101-v1:0'
  );
}

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.LITELLM_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing LITELLM_API_KEY or OPENAI_API_KEY for ID extraction.',
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

export type VisionImageInput = {
  front: IdCardImageInput;
  back?: IdCardImageInput;
};

function fieldKeysFromSchema(schema: z.ZodType): string[] {
  if (schema instanceof z.ZodObject) {
    return Object.keys(schema.shape);
  }
  return [];
}

function useJsonSchemaMode(): boolean {
  return (process.env.KYC_VISION_RESPONSE_FORMAT ?? 'json_object')
    .toLowerCase()
    .includes('schema');
}

/**
 * Vision OCR via chat.completions + JSON schema (fast on LiteLLM/Bedrock).
 * The Agents SDK path with large Zod schemas was observed to hang ~120s on the
 * same model; direct API calls complete in a few seconds.
 */
export async function runVisionStructuredExtraction<T>(
  cacheKey: string,
  agentName: string,
  instructions: string,
  outputSchema: z.ZodType<T>,
  images: VisionImageInput,
  userTaskText: string,
  onProgress?: VisionProgressCallback,
): Promise<T> {
  validateImagePayload(images.front);
  if (images.back) validateImagePayload(images.back);

  const beforeFront = Buffer.from(images.front.base64, 'base64').length;
  const beforeBack = images.back
    ? Buffer.from(images.back.base64, 'base64').length
    : 0;
  onProgress?.('Compressing ID image for vision API…');
  const prepared = await prepareImagesForVision(images);
  const afterFront = Buffer.from(prepared.front.base64, 'base64').length;
  const afterBack = prepared.back
    ? Buffer.from(prepared.back.base64, 'base64').length
    : 0;
  logVisionImageSizes(
    agentName,
    beforeFront + beforeBack,
    afterFront + afterBack,
  );

  const model = getVisionModel();
  const imageDetail = getVisionImageDetail();
  onProgress?.(
    `Calling ${model} for OCR (${Math.round(afterFront / 1024)} KB image)…`,
  );

  const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
    {
      type: 'text',
      text: prepared.back
        ? userTaskText
        : `${userTaskText}\n\n(Single image — may contain front+back stacked or side-by-side; read all visible sides.)`,
    },
    {
      type: 'image_url',
      image_url: {
        url: toImageDataUrl(prepared.front),
        detail: imageDetail,
      },
    },
  ];
  if (prepared.back) {
    userContent.push({
      type: 'image_url',
      image_url: {
        url: toImageDataUrl(prepared.back),
        detail: imageDetail,
      },
    });
  }

  const client = getOpenAIClient();
  const timeoutMs = getVisionTimeoutMs();
  const keys = fieldKeysFromSchema(outputSchema);
  const systemContent = useJsonSchemaMode()
    ? instructions
    : `${instructions}\n\nReturn **only** a JSON object (no markdown). Include these keys when visible: ${keys.join(', ')}. Use empty string for missing optional text fields.`;

  const requestBody: OpenAI.Chat.ChatCompletionCreateParams = {
    model,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ],
    ...(useJsonSchemaMode()
      ? {
          response_format: {
            type: 'json_schema' as const,
            json_schema: {
              name:
                cacheKey.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64) ||
                'id_extract',
              strict: false,
              schema: toJSONSchema(outputSchema, {
                target: 'draft-07',
              }) as Record<string, unknown>,
            },
          },
        }
      : { response_format: { type: 'json_object' as const } }),
  };

  try {
    const started = Date.now();
    const completion = await withVisionTimeout(
      `${agentName} (${model})`,
      client.chat.completions.create(requestBody, { timeout: timeoutMs }),
      timeoutMs,
    );

    console.log(
      `[vision] ${agentName} finished in ${Date.now() - started}ms`,
    );

    const raw = completion.choices[0]?.message?.content;
    if (!raw?.trim()) {
      throw new Error(
        `No structured output from ${agentName}. Empty model response.`,
      );
    }

    let parsed: unknown;
    try {
      parsed = parseModelJson(raw);
    } catch {
      throw new Error(
        `Model returned non-JSON from ${agentName}: ${raw.slice(0, 200)}`,
      );
    }

    const validated = outputSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(
        `ID extraction JSON failed validation: ${validated.error.message}`,
      );
    }

    onProgress?.('ID OCR complete.');
    return validated.data;
  } catch (err) {
    throw new Error(formatVisionApiError(err));
  }
}
