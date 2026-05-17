/**
 * Test ID portrait crop + selfie face match only (no full KYC).
 *
 * Usage:
 *   npx tsx scripts/test-face-match.ts path/to/id-front.jpg path/to/selfie.jpg [documentType]
 *
 * document types: india_passport | india_driving_licence | india_aadhaar
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import {
  nationalIdDocumentTypeLabel,
  type NationalIdDocumentType,
} from '../src/idCard/documentTypes.js';
import { runFaceMatch } from '../src/idCard/faceMatch/runFaceMatch.js';
import { getFaceModel } from '../src/idCard/faceMatch/faceVisionCall.js';

const idPath = process.argv[2];
const selfiePath = process.argv[3];
const docType = (process.argv[4] ?? 'india_passport') as NationalIdDocumentType;

if (!idPath || !selfiePath) {
  console.error(
    'Usage: npx tsx scripts/test-face-match.ts <id-image> <selfie> [documentType]',
  );
  process.exit(1);
}

function readImage(filePath: string): { base64: string; mimeType: string } {
  const abs = path.resolve(filePath);
  const buf = fs.readFileSync(abs);
  const ext = path.extname(abs).toLowerCase();
  const mimeType =
    ext === '.png'
      ? 'image/png'
      : ext === '.webp'
        ? 'image/webp'
        : 'image/jpeg';
  return { base64: buf.toString('base64'), mimeType };
}

const id = readImage(idPath);
const selfie = readImage(selfiePath);

console.log(`Face model: ${getFaceModel()}`);
console.log(`ID: ${path.resolve(idPath)}`);
console.log(`Selfie: ${path.resolve(selfiePath)}`);
console.log(`Document: ${docType}`);
console.log('Running face match…');

const started = Date.now();
try {
  const result = await runFaceMatch({
    idFront: id,
    selfie: {
      imageBase64: selfie.base64,
      mimeType: selfie.mimeType,
    },
    documentTypeLabel: nationalIdDocumentTypeLabel(docType),
    uploadMode: 'single',
    onProgress: (msg) => console.log(`  → ${msg}`),
  });
  console.log(`Done in ${Date.now() - started}ms\n`);
  console.log(
    JSON.stringify(
      {
        overallStatus: result.overallStatus,
        confidenceScore: result.confidenceScore,
        recommendation: result.recommendation,
        facialFeatureNotes: result.facialFeatureNotes,
        livenessNotes: result.livenessNotes,
        bbox: result.bbox,
        idFacePreviewLength: result.idFacePreviewDataUrl.length,
      },
      null,
      2,
    ),
  );
} catch (err) {
  console.error(`Failed after ${Date.now() - started}ms:`);
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
