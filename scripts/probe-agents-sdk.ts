/**
 * Tests whether @openai/agents Runner hangs on vision + structured output.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import {
  Agent,
  OpenAIProvider,
  Runner,
  setOpenAIAPI,
  setTracingDisabled,
  user,
} from '@openai/agents';
import { z } from 'zod';

const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: npx tsx scripts/probe-agents-sdk.ts <image.jpg>');
  process.exit(1);
}

const model =
  process.env.KYC_VISION_MODEL ??
  process.env.KYC_MODEL ??
  'us.anthropic.claude-opus-4-5-20251101-v1:0';
const apiKey = process.env.LITELLM_API_KEY!;
const baseURL = process.env.LITELLM_BASE_URL;

const buf = fs.readFileSync(path.resolve(imagePath));
const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;

const schema = z.object({
  passportNumber: z.string(),
  fullLegalName: z.string(),
});

setOpenAIAPI('chat_completions');
setTracingDisabled(true);

const provider = new OpenAIProvider({ apiKey, baseURL });
const agent = new Agent({
  name: 'probe',
  model,
  instructions: 'Extract passport fields from the image.',
  outputType: schema,
});

const content = [
  { type: 'input_text' as const, text: 'Extract passport number and name.' },
  { type: 'input_image' as const, image: dataUrl, detail: 'auto' },
];

console.log(`model=${model}`);
const t0 = Date.now();
const runner = new Runner({ modelProvider: provider });

const timeout = setTimeout(() => {
  console.error(`Still running after ${Date.now() - t0}ms — likely Agents SDK hang`);
  process.exit(2);
}, 90_000);

try {
  const result = await runner.run(agent, [user(content)], { maxTurns: 1 });
  clearTimeout(timeout);
  console.log(`OK in ${Date.now() - t0}ms`);
  console.log(JSON.stringify(result.finalOutput, null, 2));
} catch (e) {
  clearTimeout(timeout);
  console.error(`FAILED in ${Date.now() - t0}ms`, e);
  process.exit(1);
}
