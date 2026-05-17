/**
 * Step-through: minimal agent vs full passport schema vs sharp image.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { extractIndiaPassport } from '../src/idCard/extractPassport.js';
import { prepareImageForVision } from '../src/idCard/prepareImageForVision.js';
import {
  Agent,
  OpenAIProvider,
  Runner,
  setOpenAIAPI,
  setTracingDisabled,
  user,
} from '@openai/agents';
import {
  INDIA_PASSPORT_EXTRACTION_PROMPT,
  indiaPassportExtractionSchema,
} from '../src/idCard/indiaPassport.js';

const imagePath = process.argv[2]!;
const buf = fs.readFileSync(path.resolve(imagePath));
const raw = {
  base64: buf.toString('base64'),
  mimeType: 'image/jpeg' as const,
};
const prepared = await prepareImageForVision(raw);

const model = process.env.KYC_MODEL!;
const provider = new OpenAIProvider({
  apiKey: process.env.LITELLM_API_KEY!,
  baseURL: process.env.LITELLM_BASE_URL,
});

async function runAgent(label: string, image: string, useFullSchema: boolean) {
  setOpenAIAPI('chat_completions');
  setTracingDisabled(true);
  const schema = useFullSchema
    ? indiaPassportExtractionSchema
    : indiaPassportExtractionSchema.pick({
        passportNumber: true,
        fullLegalName: true,
      });
  const agent = new Agent({
    name: label,
    model,
    instructions: useFullSchema
      ? INDIA_PASSPORT_EXTRACTION_PROMPT
      : 'Extract passport fields.',
    outputType: schema,
  });
  const t0 = Date.now();
  const runner = new Runner({ modelProvider: provider });
  const result = await runner.run(
    agent,
    [
      user([
        { type: 'input_text', text: 'Extract from this passport.' },
        { type: 'input_image', image, detail: 'auto' },
      ]),
    ],
    { maxTurns: 1 },
  );
  console.log(`${label}: OK ${Date.now() - t0}ms`, result.finalOutput);
}

console.log('1) extractIndiaPassport (production path)…');
const t0 = Date.now();
try {
  const r = await extractIndiaPassport({
    front: raw,
    onProgress: (m) => console.log(' ', m),
  });
  console.log('extractIndiaPassport OK', Date.now() - t0, r.passportNumber);
} catch (e) {
  console.log('extractIndiaPassport FAIL', Date.now() - t0, e);
}

console.log('\n2) minimal schema + raw image…');
await runAgent('minimal-raw', `data:image/jpeg;base64,${raw.base64}`, false);

console.log('\n3) full schema + sharp image…');
await runAgent(
  'full-sharp',
  `data:image/jpeg;base64,${prepared.base64}`,
  true,
);
