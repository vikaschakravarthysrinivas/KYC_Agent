import 'dotenv/config';
import fs from 'fs';
import OpenAI from 'openai';
import { toJSONSchema } from 'zod/v4';
import {
  indiaPassportExtractionSchema,
  INDIA_PASSPORT_EXTRACTION_PROMPT,
} from '../src/idCard/indiaPassport.js';

const buf = fs.readFileSync(
  process.argv[2] ?? '/Users/vikas.chakravarthysr/Downloads/Passport_Sample.jpg',
);
const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
const client = new OpenAI({
  apiKey: process.env.LITELLM_API_KEY!,
  baseURL: process.env.LITELLM_BASE_URL,
});
const schema = toJSONSchema(indiaPassportExtractionSchema, { target: 'draft-07' });
console.log('properties:', Object.keys((schema as { properties?: object }).properties ?? {}).length);
const t0 = Date.now();
const r = await client.chat.completions.create(
  {
    model: process.env.KYC_MODEL!,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: INDIA_PASSPORT_EXTRACTION_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract passport fields.' },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'passport', strict: false, schema },
    },
  },
  { timeout: 90_000 },
);
console.log('OK', Date.now() - t0, 'ms');
console.log(r.choices[0]?.message?.content?.slice(0, 200));
