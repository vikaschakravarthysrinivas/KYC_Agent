import { z } from 'zod';

export const indiaAadhaarExtractionSchema = z.object({
  documentType: z.string().describe('e.g. India Aadhaar'),
  aadhaarNumber: z
    .string()
    .describe('12-digit Aadhaar as printed, often grouped (6645 2642 1992)'),
  virtualId: z.string().optional().describe('VID if printed on back'),
  fullLegalName: z.string().describe('Name in English'),
  dateOfBirth: z.string().describe('DOB as printed (often DD/MM/YYYY)'),
  gender: z.string().optional(),
  fatherOrGuardianName: z
    .string()
    .optional()
    .describe('From S/O, D/O, W/O, or C/O on address side'),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  stateRegion: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  rawAddressBlock: z.string().optional().describe('Full address in English'),
  extractionNotes: z.string().optional(),
});

export type IndiaAadhaarExtraction = z.infer<typeof indiaAadhaarExtractionSchema>;

export const INDIA_AADHAAR_EXTRACTION_PROMPT = `You extract structured identity fields from **Indian Aadhaar** card image(s).

Layouts:
- Standard PVC card: **front** = photo, name, DOB, gender, 12-digit Aadhaar number; **back** = address (Hindi + English), QR, helpline.
- One image may show **front stacked above back** (dashed fold line) — read both.
- Name and address appear in regional language and **English** — use **English** for fullLegalName and address fields.
- Aadhaar number: 12 digits, often shown as four groups of four (keep spaces in aadhaarNumber).
- Address on back: parse S/O, D/O, W/O, C/O into fatherOrGuardianName; split city, state, PIN when possible.
- VID (Virtual ID) is optional 16-digit masked ID on some cards.
- Disclaimer text ("proof of identity, not citizenship") is not DOB proof — note in extractionNotes if relevant.
- Do not invent illegible digits.`;
