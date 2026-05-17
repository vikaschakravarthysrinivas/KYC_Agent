/**
 * Isolates LiteLLM vision latency vs Agents SDK structured extraction.
 *
 *   npx tsx scripts/probe-vision-api.ts /path/to/image.jpg
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';

const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: npx tsx scripts/probe-vision-api.ts <image.jpg>');
  process.exit(1);
}

const apiKey = process.env.LITELLM_API_KEY ?? process.env.OPENAI_API_KEY;
const baseURL =
  process.env.LITELLM_BASE_URL ?? process.env.OPENAI_BASE_URL ?? undefined;
const model =
  process.env.KYC_VISION_MODEL ??
  process.env.KYC_MODEL ??
  'us.anthropic.claude-opus-4-5-20251101-v1:0';

if (!apiKey) {
  console.error('Missing LITELLM_API_KEY');
  process.exit(1);
}

const buf = fs.readFileSync(path.resolve(imagePath));
const b64 = buf.toString('base64');
const dataUrl = `data:image/jpeg;base64,${b64}`;

const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  console.log(`\n[${label}] starting…`);
  try {
    const result = await fn();
    console.log(`[${label}] OK in ${Date.now() - t0}ms`);
    return result;
  } catch (e) {
    console.log(`[${label}] FAILED in ${Date.now() - t0}ms`);
    throw e;
  }
}

console.log(`baseURL=${baseURL}`);
console.log(`model=${model}`);
console.log(`image=${Math.round(buf.length / 1024)} KB`);

await timed('plain-vision-text', () =>
  client.chat.completions.create(
    {
      model,
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'What document is this? Reply in one sentence with passport number if visible.',
            },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
          ],
        },
      ],
    },
    { timeout: 60_000 },
  ),
).then((r) => console.log('  reply:', r.choices[0]?.message?.content?.slice(0, 200)));

await timed('json-schema-vision', () =>
  client.chat.completions.create(
    {
      model,
      max_tokens: 800,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'passport_stub',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              passportNumber: { type: 'string' },
              fullLegalName: { type: 'string' },
            },
            required: ['passportNumber', 'fullLegalName'],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract passport number and full name from this Indian passport image.',
            },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
          ],
        },
      ],
    },
    { timeout: 90_000 },
  ),
).then((r) => console.log('  json:', r.choices[0]?.message?.content?.slice(0, 300)));

console.log('\nDone. If plain-vision works but json-schema hangs, the Agents extraction path (structured output) is the bottleneck on this model.');
