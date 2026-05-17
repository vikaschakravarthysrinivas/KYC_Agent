import { z } from 'zod';

export const indiaPassportExtractionSchema = z.object({
  documentType: z.string().describe('e.g. India Passport'),
  passportNumber: z.string().describe('Passport no. e.g. Y5401360'),
  surname: z.string().optional(),
  givenNames: z.string().optional(),
  fullLegalName: z
    .string()
    .optional()
    .describe('Given name(s) + surname if helpful for display'),
  nationality: z.string().optional(),
  sex: z.string().optional(),
  dateOfBirth: z.string().optional(),
  placeOfBirth: z.string().optional(),
  placeOfIssue: z.string().optional(),
  dateOfIssue: z.string().optional(),
  dateOfExpiry: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  spouseName: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  stateRegion: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  rawAddressBlock: z.string().optional(),
  fileNumber: z.string().optional(),
  mrzLine1: z.string().optional(),
  mrzLine2: z.string().optional(),
  extractionNotes: z.string().optional(),
});

export type IndiaPassportExtraction = z.infer<typeof indiaPassportExtractionSchema>;

export const INDIA_PASSPORT_EXTRACTION_PROMPT = `You extract structured identity fields from **Indian passport** booklet page image(s).

Layouts:
- **Bio page (front):** REPUBLIC OF INDIA header, Type P, passport number, surname, given name(s), nationality INDIAN, sex, DOB, place of birth/issue, issue/expiry dates, photo, MRZ two lines at bottom.
- **Address/family page (back):** father, mother, spouse, full address with PIN, file number, barcode.
- One upload may show **both pages side-by-side or stacked** — extract from all visible pages.
- fullLegalName: combine given name(s) and surname naturally (e.g. ABHISHEK JITENDRABHAI SOLANKI).
- passportNumber: alphanumeric as printed (no spaces).
- Dates: preserve DD/MM/YYYY as printed.
- Address: split into lines, city, stateRegion, postalCode (PIN), country India.
- Use MRZ to cross-check passport number and DOB when visible; note conflicts in extractionNotes.
- Do not invent illegible characters.`;
