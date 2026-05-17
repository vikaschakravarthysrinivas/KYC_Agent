import { z } from 'zod';

export const faceMatchStatusSchema = z.enum([
  'match',
  'likely_match',
  'no_match',
  'unable_to_verify',
]);

export type FaceMatchStatus = z.infer<typeof faceMatchStatusSchema>;

export const faceBBoxSchema = z.object({
  faceDetected: z.boolean(),
  boundingBox: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().min(0).max(1),
      height: z.number().min(0).max(1),
    })
    .optional(),
  sourceSide: z
    .string()
    .optional()
    .describe('e.g. front, left_half, combined_scan'),
  notes: z.string().optional(),
});

export type FaceBBoxResult = z.infer<typeof faceBBoxSchema>;

export const faceCompareSchema = z.object({
  overallStatus: faceMatchStatusSchema,
  confidenceScore: z.number().min(0).max(100),
  facialFeatureNotes: z.string(),
  livenessNotes: z
    .string()
    .optional()
    .describe('Demo only — static photo comparison, not video liveness'),
  recommendation: z.string(),
});

export type FaceCompareResult = z.infer<typeof faceCompareSchema>;

/** Single vision response: portrait bbox + selfie comparison (json_object). */
const normalizedBBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

export const faceMatchCombinedSchema = z.object({
  faceDetected: z.boolean(),
  boundingBox: normalizedBBoxSchema.optional(),
  sourceSide: z.string().optional(),
  bboxNotes: z.string().optional(),
  overallStatus: faceMatchStatusSchema,
  confidenceScore: z.number().min(0).max(100),
  facialFeatureNotes: z.string(),
  livenessNotes: z.string().optional(),
  recommendation: z.string(),
});

export type FaceMatchCombinedResult = z.infer<typeof faceMatchCombinedSchema>;

export type FaceMatchResult = FaceCompareResult & {
  idFacePreviewDataUrl: string;
  bbox: FaceBBoxResult;
  summaryForAgent: string;
};

import type { IdCardImageInput } from '../imageInput.js';

export type CroppedIdFace = {
  crop: IdCardImageInput;
  previewDataUrl: string;
};
