import { z } from 'zod';

/** Model often returns { class, date } per row; we store display strings. */
const vehicleClassItemSchema = z.union([
  z.string(),
  z
    .object({
      class: z.string().optional(),
      code: z.string().optional(),
      name: z.string().optional(),
      vehicleClass: z.string().optional(),
      type: z.string().optional(),
      date: z.string().optional(),
      validFrom: z.string().optional(),
      issued: z.string().optional(),
    })
    .passthrough(),
]);

function normalizeVehicleClassEntry(
  item: z.infer<typeof vehicleClassItemSchema>,
): string {
  if (typeof item === 'string') return item.trim();
  const rec = item as Record<string, unknown>;
  const code = [
    rec.class,
    rec.code,
    rec.name,
    rec.vehicleClass,
    rec.type,
  ].find((v) => typeof v === 'string' && v.trim());
  const label = (code as string | undefined)?.trim() || 'Unknown';
  const date = [rec.date, rec.validFrom, rec.issued].find(
    (v) => typeof v === 'string' && v.trim(),
  ) as string | undefined;
  return date?.trim() ? `${label} (${date.trim()})` : label;
}

const vehicleClassesSchema = z
  .array(vehicleClassItemSchema)
  .optional()
  .transform((arr) => arr?.map(normalizeVehicleClassEntry));

export const indiaDlExtractionSchema = z.object({
  documentType: z
    .string()
    .describe('e.g. India Driving Licence (Tamil Nadu)'),
  licenseNumber: z
    .string()
    .describe('DL number as printed on front (e.g. TN54 20080003680)'),
  licenseNumberBack: z
    .string()
    .optional()
    .describe('DL number on back if different or repeated'),
  fullLegalName: z.string().describe('Name of licence holder'),
  dateOfBirth: z.string().describe('DOB as on card (keep original format)'),
  fatherOrGuardianName: z.string().optional(),
  bloodGroup: z.string().optional(),
  dateOfIssue: z.string().optional(),
  validUntil: z.string().optional().describe('Primary validity / NT expiry'),
  validUntilTransport: z.string().optional(),
  addressLine1: z.string().optional().describe('Street / locality — often on back'),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  stateRegion: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional().describe('Default India if domestic DL'),
  rawAddressBlock: z
    .string()
    .optional()
    .describe('Full address text if not cleanly split'),
  issuingAuthority: z.string().optional().describe('RTO office name if visible'),
  badgeNumber: z.string().optional(),
  vehicleClasses: vehicleClassesSchema.describe(
    'e.g. LMV, MCWG — string per class, optional date in parentheses',
  ),
  extractionNotes: z
    .string()
    .optional()
    .describe('Illegible regions, glare, or front/back conflicts'),
});

export type IndiaDlExtraction = z.infer<typeof indiaDlExtractionSchema>;

export const INDIA_DL_EXTRACTION_PROMPT = `You extract structured identity fields from **Indian Union driving licence** card image(s).

Layouts vary by state/UT and card generation (Parivahan smart card, older booklet-style, etc.):
- **Classic TN-style:** "UNION OF INDIA Driving Licence (State)" header; DL No. at top; name/DOB on front; address on back.
- **Smart card (many states):** "Indian Union Driving Licence" + issuing state/UT; DL NO. prominent; address may be on **front** (Delhi, Mizoram, Andaman) or **back** (TN, UK).
- **Chhattisgarh-style:** blue header, map watermark; address and vehicle classes on front; back has Hindi safety text only.
- **Combined scan:** one wide image with front **left** and back **right** — read both halves as one licence.
- **Reject non-DL:** if an image is clearly a vehicle RC, PAN, or other document, do not extract RC fields; note in extractionNotes.

Rules:
- Front usually has: DL No., Name, DOB, issue/validity dates, blood group, S/D/W of, photo, chip, QR.
- Back usually has: address (if not on front), LMV/MCWG/TRANS class table, RTO, signatures, badge.
- Multiple images OR one combined front+back image: merge into one record; prefer dedicated back image for address when present.
- Date formats: DD-MM-YYYY, DD/MM/YYYY, or DD MMM YYYY — preserve as printed.
- DL number: keep spaces as printed (e.g. TN07 20150002653, CG04 20210009418).
- If front/back DL numbers differ, primary on licenseNumber, alternate on licenseNumberBack; explain in extractionNotes.
- Split address into line1, city, stateRegion, postalCode when possible; always fill rawAddressBlock when useful.
- country: "India" for domestic licences.
- documentType: include state/UT in label (e.g. "India Driving Licence (Tamil Nadu)").
- vehicleClasses: return a JSON array of **strings** only (e.g. "LMV", "MCWG (20-03-2018)"), not objects per class.
- Do not invent illegible fields.`;
