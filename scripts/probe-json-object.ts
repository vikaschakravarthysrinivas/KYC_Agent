import 'dotenv/config';
import fs from 'fs';
import OpenAI from 'openai';
import { indiaPassportExtractionSchema } from '../src/idCard/indiaPassport.js';

const buf = fs.readFileSync('/Users/vikas.chakravarthysr/Downloads/Passport_Sample.jpg');
const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
const client = new OpenAI({
  apiKey: process.env.LITELLM_API_KEY!,
  baseURL: process.env.LITELLM_BASE_URL,
});

const fields = Object.keys(indiaPassportExtractionSchema.shape).join(', ');
const t0 = Date.now();
const r = await client.chat.completions.create(
  {
    model: process.env.KYC_MODEL!,
    max_tokens: 4096,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Extract Indian passport fields as JSON. Keys: ${fields}. Use empty string for missing.`,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract all visible passport fields.' },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
        ],
      },
    ],
  },
  { timeout: 60_000 },
);
const parsed = indiaPassportExtractionSchema.safeParse(
  JSON.parse(r.choices[0]?.message?.content ?? '{}'),
);
console.log('OK', Date.now() - t0, 'valid', parsed.success);
if (parsed.success) console.log(parsed.data.passportNumber, parsed.data.fullLegalName);
