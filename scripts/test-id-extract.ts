/**
 * Test ID vision extraction only (no full KYC).
 *
 * Usage:
 *   npx tsx scripts/test-id-extract.ts path/to/id.png india_passport
 *
 * document types: india_passport | india_driving_licence | india_aadhaar
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { extractNationalId } from '../src/idCard/extractNationalId.js';
import type { NationalIdDocumentType } from '../src/idCard/documentTypes.js';
import { getVisionModel } from '../src/idCard/runVisionExtraction.js';

const imagePath = process.argv[2];
const docType = (process.argv[3] ?? 'india_passport') as NationalIdDocumentType;

if (!imagePath) {
  console.error(
    'Usage: npx tsx scripts/test-id-extract.ts <image.png> [documentType]',
  );
  process.exit(1);
}

const abs = path.resolve(imagePath);
const buf = fs.readFileSync(abs);
const ext = path.extname(abs).toLowerCase();
const mimeType =
  ext === '.png'
    ? 'image/png'
    : ext === '.webp'
      ? 'image/webp'
      : 'image/jpeg';

console.log(`Model: ${getVisionModel()}`);
console.log(`File: ${abs} (${Math.round(buf.length / 1024)} KB)`);
console.log(`Document: ${docType}`);
console.log('Extracting…');

const started = Date.now();
try {
  const result = await extractNationalId({
    documentType: docType,
    front: { base64: buf.toString('base64'), mimeType },
    onProgress: (msg) => console.log(`  → ${msg}`),
  });
  console.log(`Done in ${Date.now() - started}ms\n`);
  console.log(JSON.stringify(result.raw, null, 2));
} catch (err) {
  console.error(`Failed after ${Date.now() - started}ms:`);
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
