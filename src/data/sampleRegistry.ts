/**
 * Synthetic internal customer / prior-KYC records for demo matching only.
 * Not real people or production data. ID numbers are fictional patterns.
 */
export type RegistryRecord = {
  id: string;
  fullLegalName: string;
  dateOfBirth: string;
  nationality: string;
  /** Primary street address on file. */
  addressLine1: string;
  /** Unit / floor / landmark when applicable; empty string if none. */
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  idDocumentType: string;
  /** Synthetic document reference (demo only; never real government IDs). */
  idProofNumber: string;
  email: string;
  phone: string;
  /** Internal risk / compliance flags on file. */
  riskFlags: string[];
  /** High-level onboarding posture for the demo registry. */
  customerStatus:
    | 'clean'
    | 'enhanced_dd_required'
    | 'prior_fraud_alert'
    | 'blocked'
    | 'pep_watchlist';
  internalNotes: string;
};

type RowDef = readonly [
  id: string,
  fullLegalName: string,
  dateOfBirth: string,
  nationality: string,
  addressLine1: string,
  addressLine2: string,
  city: string,
  stateRegion: string,
  postalCode: string,
  country: string,
  idDocumentType: string,
  idProofNumber: string,
  email: string,
  phone: string,
  riskFlags: string[],
  customerStatus: RegistryRecord['customerStatus'],
  internalNotes: string,
];

const ROWS = [
  [
    'REG-001',
    'Vikram Ambalal Sarabhai',
    '1919-08-12',
    'India',
    '14 Crescent Road',
    'Near Gujarat University',
    'Ahmedabad',
    'Gujarat',
    '380001',
    'India',
    'Passport',
    'SYN-IN-PPT-19190812-A1',
    'vikram.sarabhai.demo@example.invalid',
    '+91-70000-00001',
    [],
    'clean',
    'Historical notable person record — demo only.',
  ],
  [
    'REG-002',
    'Ananya Krishnan',
    '1992-04-17',
    'India',
    '42 Anna Salai',
    'Floor 3',
    'Chennai',
    'Tamil Nadu',
    '600002',
    'India',
    'Aadhaar (masked ref)',
    'SYN-IN-AAD-9217-8842',
    'ananya.krishnan.demo@example.invalid',
    '+91-70000-00002',
    [],
    'clean',
    'Retail salary account opened 2021.',
  ],
  [
    'REG-003',
    'Rahul Mehta',
    '1988-11-03',
    'India',
    '9 Bandra Kurla Complex',
    'Tower C',
    'Mumbai',
    'Maharashtra',
    '400051',
    'India',
    'PAN',
    'SYN-IN-PAN-MEH8803-R9',
    'rahul.mehta.demo@example.invalid',
    '+91-70000-00003',
    ['high_velocity_wire'],
    'enhanced_dd_required',
    'Unusual wire velocity last quarter.',
  ],
  [
    'REG-004',
    'Priya Natarajan',
    '1995-01-29',
    'India',
    '18 MG Road',
    '',
    'Bengaluru',
    'Karnataka',
    '560001',
    'India',
    'Passport',
    'SYN-IN-PPT-950129-P4',
    'priya.natarajan.demo@example.invalid',
    '+91-70000-00004',
    [],
    'clean',
    '',
  ],
  [
    'REG-005',
    'David Chen',
    '1984-07-08',
    'United States',
    '200 Market Street',
    'Suite 1400',
    'San Francisco',
    'CA',
    '94105',
    'United States',
    'Passport',
    'SYN-US-PPT-840708-DC7',
    'david.chen.demo@example.invalid',
    '+1-415-555-0105',
    ['foreign_pep_related'],
    'pep_watchlist',
    'PEP-adjacent; EDD completed 2024-Q2.',
  ],
  [
    'REG-006',
    'Fatima Al-Hassan',
    '1990-12-20',
    'United Arab Emirates',
    '3 Sheikh Zayed Road',
    'Apt 12B',
    'Dubai',
    'Dubai',
    '00000',
    'United Arab Emirates',
    'Emirates ID (ref)',
    'SYN-AE-EID-901220-FH2',
    'fatima.hassan.demo@example.invalid',
    '+971-4-555-0106',
    [],
    'clean',
    '',
  ],
  [
    'REG-007',
    "James O'Brien",
    '1979-03-15',
    'Ireland',
    '77 Harcourt Street',
    '',
    'Dublin',
    'Leinster',
    'D02 XY45',
    'Ireland',
    'Passport',
    'SYN-IE-PPT-790315-JO1',
    'james.obrien.demo@example.invalid',
    '+353-1-555-0107',
    ['chargeback_spike'],
    'prior_fraud_alert',
    'Merchant acquiring; dispute spike.',
  ],
  [
    'REG-008',
    'Sunita Rao',
    '1986-09-02',
    'India',
    '55 Jubilee Hills',
    'Road No 36',
    'Hyderabad',
    'Telangana',
    '500033',
    'India',
    'Driver License',
    'SYN-IN-DL-TS-860902-SR',
    'sunita.rao.demo@example.invalid',
    '+91-70000-00008',
    [],
    'clean',
    '',
  ],
  [
    'REG-009',
    'Carlos Mendes',
    '1993-06-30',
    'Brazil',
    'Av. Paulista 1000',
    'Conj. 501',
    'São Paulo',
    'SP',
    '01310-100',
    'Brazil',
    'National ID (ref)',
    'SYN-BR-RG-930630-CM4',
    'carlos.mendes.demo@example.invalid',
    '+55-11-5555-0109',
    ['sanctions_false_positive_cleared'],
    'enhanced_dd_required',
    'False positive cleared with vendor ref FP-8831.',
  ],
  [
    'REG-010',
    'Meera Iyer',
    '2001-02-14',
    'India',
    '12 Cathedral Road',
    '',
    'Chennai',
    'Tamil Nadu',
    '600086',
    'India',
    'Aadhaar (masked ref)',
    'SYN-IN-AAD-0102-6610',
    'meera.iyer.demo@example.invalid',
    '+91-70000-00010',
    [],
    'clean',
    'Student account.',
  ],
  [
    'REG-011',
    'Oliver Schmidt',
    '1981-10-22',
    'Germany',
    'Unter den Linden 1',
    '',
    'Berlin',
    'Berlin',
    '10117',
    'Germany',
    'National ID (ref)',
    'SYN-DE-PERSO-811022-OS',
    'oliver.schmidt.demo@example.invalid',
    '+49-30-555-0111',
    [],
    'clean',
    '',
  ],
  [
    'REG-012',
    'Yuki Tanaka',
    '1994-05-05',
    'Japan',
    '2-8 Shibuya',
    'Shibuya Hikarie 15F',
    'Tokyo',
    'Tokyo',
    '150-0002',
    'Japan',
    'My Number Card (ref)',
    'SYN-JP-MNC-940505-YT',
    'yuki.tanaka.demo@example.invalid',
    '+81-3-5555-0112',
    [],
    'clean',
    '',
  ],
  [
    'REG-013',
    'Kwame Asante',
    '1987-08-18',
    'Ghana',
    'Independence Ave 45',
    '',
    'Accra',
    'Greater Accra',
    'GA-184',
    'Ghana',
    'National ID (ref)',
    'SYN-GH-NID-870818-KA',
    'kwame.asante.demo@example.invalid',
    '+233-30-555-0113',
    ['document_quality_issue'],
    'enhanced_dd_required',
    'Prior passport image glare resubmission.',
  ],
  [
    'REG-014',
    'Elena Popescu',
    '1996-12-01',
    'Romania',
    'Str. Victoriei 10',
    'Bloc A',
    'Bucharest',
    'Bucharest',
    '030167',
    'Romania',
    'National ID (ref)',
    'SYN-RO-CN-961201-EP',
    'elena.popescu.demo@example.invalid',
    '+40-21-555-0114',
    [],
    'clean',
    '',
  ],
  [
    'REG-015',
    'Hardeep Singh',
    '1990-03-09',
    'India',
    'Plot 22 Sector 18',
    '',
    'Gurugram',
    'Haryana',
    '122015',
    'India',
    'PAN',
    'SYN-IN-PAN-SIN9003-H5',
    'hardeep.singh.demo@example.invalid',
    '+91-70000-00015',
    ['adverse_media_mentions'],
    'enhanced_dd_required',
    'Adverse media review pending legal sign-off.',
  ],
  [
    'REG-016',
    'Linda van der Berg',
    '1975-07-27',
    'Netherlands',
    'Keizersgracht 520',
    '',
    'Amsterdam',
    'North Holland',
    '1017 EK',
    'Netherlands',
    'National ID (ref)',
    'SYN-NL-BSN-750727-LV',
    'linda.vandenberg.demo@example.invalid',
    '+31-20-555-0116',
    [],
    'clean',
    '',
  ],
  [
    'REG-017',
    'Mohammed Farouk',
    '1983-01-11',
    'Egypt',
    '15 Zamalek Street',
    '',
    'Cairo',
    'Cairo',
    '11211',
    'Egypt',
    'National ID (ref)',
    'SYN-EG-NID-830111-MF',
    'mohammed.farouk.demo@example.invalid',
    '+20-2-555-0117',
    [],
    'clean',
    '',
  ],
  [
    'REG-018',
    'Sophie Martin',
    '1999-09-19',
    'France',
    '88 Rue de Rivoli',
    'Esc. B',
    'Paris',
    'Île-de-France',
    '75004',
    'France',
    'National ID (ref)',
    'SYN-FR-CNI-990919-SM',
    'sophie.martin.demo@example.invalid',
    '+33-1-5555-0118',
    ['structuring_alerts'],
    'prior_fraud_alert',
    'AML monitoring case ARC-992 closed with warning.',
  ],
  [
    'REG-019',
    'Arjun Venkatesh',
    '1991-06-06',
    'India',
    '7 Residency Road',
    '',
    'Bengaluru',
    'Karnataka',
    '560025',
    'India',
    'Passport',
    'SYN-IN-PPT-910606-AV2',
    'arjun.venkatesh.demo@example.invalid',
    '+91-70000-00019',
    [],
    'clean',
    '',
  ],
  [
    'REG-020',
    'Nina Kowalski',
    '1989-04-04',
    'Poland',
    'Nowy Świat 50',
    'Lok. 8',
    'Warsaw',
    'Masovian',
    '00-363',
    'Poland',
    'National ID (ref)',
    'SYN-PL-PESEL-890404-NK',
    'nina.kowalski.demo@example.invalid',
    '+48-22-555-0120',
    [],
    'clean',
    '',
  ],
  [
    'REG-021',
    'Vikram Sarabhai',
    '1890-01-01',
    'India',
    '123 Main St',
    'Demo synthetic row',
    'Chennai',
    'Tamil Nadu',
    '600017',
    'India',
    'Passport',
    'SYN-IN-PPT-DEMO-1890',
    'vikram.sarabhai.synthetic@example.invalid',
    '+91-70000-00021',
    ['identity_synthetic_test_profile'],
    'blocked',
    'Demo synthetic profile matching common user test strings; DOB conflicts with REG-001.',
  ],
  [
    'REG-022',
    'Chen Wei',
    '1982-12-12',
    'China',
    '88 Nanjing Road',
    'Unit 402',
    'Shanghai',
    'Shanghai',
    '200003',
    'China',
    'National ID (ref)',
    'SYN-CN-NID-821212-CW',
    'chen.wei.demo@example.invalid',
    '+86-21-5555-0122',
    [],
    'clean',
    '',
  ],
  [
    'REG-023',
    'Isabelle Fontaine',
    '1997-07-07',
    'Switzerland',
    '10 Rue du Rhône',
    '',
    'Geneva',
    'Geneva',
    '1204',
    'Switzerland',
    'Passport',
    'SYN-CH-PPT-970707-IF',
    'isabelle.fontaine.demo@example.invalid',
    '+41-22-555-0123',
    ['private_banking_tier'],
    'enhanced_dd_required',
    'Private banking onboarding tier.',
  ],
  [
    'REG-024',
    'Thomas Müller',
    '1980-02-28',
    'Germany',
    'Marienplatz 8',
    '',
    'Munich',
    'Bavaria',
    '80331',
    'Germany',
    'National ID (ref)',
    'SYN-DE-PERSO-800228-TM',
    'thomas.mueller.demo@example.invalid',
    '+49-89-555-0124',
    [],
    'clean',
    '',
  ],
  [
    'REG-025',
    'Keiko Yamamoto',
    '1993-10-10',
    'Japan',
    '1-1 Umeda',
    'Osaka Station City North',
    'Osaka',
    'Osaka',
    '530-0001',
    'Japan',
    'My Number Card (ref)',
    'SYN-JP-MNC-931010-KY',
    'keiko.yamamoto.demo@example.invalid',
    '+81-6-5555-0125',
    [],
    'clean',
    '',
  ],
  [
    'REG-026',
    'Samuel Okonkwo',
    '1985-05-25',
    'Nigeria',
    '22 Broad Street',
    'Marina',
    'Lagos',
    'Lagos',
    '100212',
    'Nigeria',
    'National ID (ref)',
    'SYN-NG-NIN-850525-SO',
    'samuel.okonkwo.demo@example.invalid',
    '+234-1-555-0126',
    ['beneficial_owner_complexity'],
    'enhanced_dd_required',
    'Corporate structure BO graph depth 4.',
  ],
  [
    'REG-027',
    "Hannah O'Connor",
    '2000-08-08',
    'Ireland',
    '5 Trinity College Green',
    '',
    'Dublin',
    'Leinster',
    'D02 EH21',
    'Ireland',
    'Passport',
    'SYN-IE-PPT-000808-HO',
    'hannah.oconnor.demo@example.invalid',
    '+353-1-555-0127',
    [],
    'clean',
    '',
  ],
  [
    'REG-028',
    'Rajesh Khanna',
    '1942-12-29',
    'India',
    'Plot 9 Juhu Tara Road',
    '',
    'Mumbai',
    'Maharashtra',
    '400049',
    'India',
    'PAN',
    'SYN-IN-PAN-KHA4212-R9',
    'rajesh.khanna.demo@example.invalid',
    '+91-70000-00028',
    ['deceased_customer_record'],
    'blocked',
    'Deceased flag — onboarding should hard-stop.',
  ],
  // --- Sample ID card holders (samples/id-cards/*) — use matching form + registry_lookup ---
  [
    'REG-029',
    'Ramachandhiran',
    '1983-10-03',
    'India',
    '80, 1st Ward, Pillaiyar Kovil Street',
    'Masinaickenpatty',
    'Salem',
    'Tamil Nadu',
    '636103',
    'India',
    'India Driving Licence',
    'TN54 20080003680',
    'ramachandhiran.demo@example.invalid',
    '+91-70000-00129',
    [],
    'clean',
    'DL sample — samples/id-cards/india-dl/ramachandhiran-*.png',
  ],
  [
    'REG-030',
    'VR Kathirselvam',
    '1961-07-23',
    'India',
    'HIG 6/32 TNHB PHASE 2, 1500 Flats',
    'Prethiyanga Temple Backside',
    'Chennai',
    'Tamil Nadu',
    '600119',
    'India',
    'India Driving Licence',
    'TN07 20150002653',
    'kathirselvam.demo@example.invalid',
    '+91-70000-00130',
    [],
    'clean',
    'DL sample — kathirselvam-tn-front-back.png',
  ],
  [
    'REG-031',
    'Ashique Ali',
    '1960-07-24',
    'India',
    'Mannarghat P.O-Mannarghat',
    'Mannarghat (RV)',
    'South Andaman',
    'Andaman and Nicobar Islands',
    '744101',
    'India',
    'India Driving Licence',
    'AN01 19790002088',
    'ashique.ali.demo@example.invalid',
    '+91-70000-00131',
    [],
    'clean',
    'DL sample — ashique-ali-an-front-back.png',
  ],
  [
    'REG-032',
    'Hardik Patel',
    '2002-01-01',
    'India',
    'Balaji Timber Bilaspur Road',
    'Near Khamtarai',
    'Raipur',
    'Chhattisgarh',
    '493221',
    'India',
    'India Driving Licence',
    'CG04 20210009418',
    'hardik.patel.demo@example.invalid',
    '+91-70000-00132',
    [],
    'clean',
    'DL sample — hardik-patel-cg-front-back.png',
  ],
  [
    'REG-033',
    'T Vijaya Bharathi',
    '1966-06-15',
    'India',
    'C 609 New Arohi Apts',
    'Sector 11 Dwarka',
    'New Delhi',
    'Delhi',
    '110078',
    'India',
    'India Driving Licence',
    'DL09 20060348573',
    'vijaya.bharathi.demo@example.invalid',
    '+91-70000-00133',
    [],
    'clean',
    'DL sample — vijaya-bharathi-delhi-dl-with-rc.png (DL half only)',
  ],
  [
    'REG-034',
    'Vanlalnghaka',
    '1982-05-28',
    'India',
    'Mualkawi',
    'Champhai District',
    'Champhai',
    'Mizoram',
    '796321',
    'India',
    'India Driving Licence',
    'MZ04 20060000532',
    'vanlalnghaka.demo@example.invalid',
    '+91-70000-00134',
    [],
    'clean',
    'DL sample — vanlalnghaka-mz-front-back.png',
  ],
  [
    'REG-035',
    'Ajay Kumar',
    '1991-08-09',
    'India',
    'BSF Camp Biaat Doiwala',
    '',
    'Rishikesh',
    'Uttarakhand',
    '248140',
    'India',
    'India Driving Licence',
    'UK14 20210002419',
    'ajay.kumar.demo@example.invalid',
    '+91-70000-00135',
    [],
    'clean',
    'DL sample — ajay-kumar-uk-front-back.png',
  ],
  [
    'REG-036',
    'Mohammed Saif Farooqi',
    '2000-07-31',
    'India',
    'B / 44, Ibrahim Park',
    'Near Saudagar Park, Tandalja',
    'Vadodara',
    'Gujarat',
    '390012',
    'India',
    'India Aadhaar',
    '6645 2642 1992',
    'mohammed.saif.farooqi.demo@example.invalid',
    '+91-70000-00136',
    [],
    'clean',
    'Aadhaar sample — mohammed-saif-farooqi-front-back.png',
  ],
  [
    'REG-037',
    'Bharat Sharma',
    '1992-11-26',
    'India',
    'Plot Number 3, Sarita Vihar',
    'Byepass Kather, Near Guru Sthan',
    'Solan',
    'Himachal Pradesh',
    '173212',
    'India',
    'India Aadhaar',
    '3306 9998 1453',
    'bharat.sharma.demo@example.invalid',
    '+91-70000-00137',
    [],
    'clean',
    'Aadhaar sample — bharat-sharma-front-back.png',
  ],
  [
    'REG-038',
    'Balveer',
    '1997-01-01',
    'India',
    'S/O Rambhrose, Tiharkheda',
    'Tihar, PO Khajuri',
    'Shahjahanpur',
    'Uttar Pradesh',
    '242127',
    'India',
    'India Aadhaar',
    '9952 6940 4912',
    'balveer.demo@example.invalid',
    '+91-70000-00138',
    [],
    'clean',
    'Aadhaar sample — balveer-front-back.png',
  ],
  [
    'REG-039',
    'Abhishek Jitendrabhai Solanki',
    '2000-11-21',
    'India',
    'Near Geeta School, Jalaram Society',
    '',
    'Veraval',
    'Gujarat',
    '362265',
    'India',
    'India Passport',
    'Y5401360',
    'abhishek.solanki.demo@example.invalid',
    '+91-70000-00139',
    [],
    'clean',
    'Passport sample — abhishek-solanki-passport-pages.png',
  ],
  [
    'REG-040',
    'Mukesh Kumar Agarwal',
    '1966-06-16',
    'India',
    '10-4-41/B Pochamma Basti',
    'Masab Tank, Asif Nagar',
    'Hyderabad',
    'Telangana',
    '500028',
    'India',
    'India Passport',
    'P7715469',
    'mukesh.agarwal.demo@example.invalid',
    '+91-70000-00140',
    [],
    'clean',
    'Passport sample — mukesh-agarwal-passport-pages.png',
  ],
  [
    'REG-041',
    'Naser Hussain Mohammed',
    '1999-12-20',
    'India',
    'H No 18-7-426/134/A, Nasheman Nagar',
    'Charminar',
    'Hyderabad',
    'Telangana',
    '500002',
    'India',
    'India Passport',
    'V3198773',
    'naser.mohammed.demo@example.invalid',
    '+91-70000-00141',
    [],
    'clean',
    'Passport sample — naser-mohammed-passport-pages.png',
  ],
] as const satisfies readonly RowDef[];

export const SAMPLE_REGISTRY: RegistryRecord[] = ROWS.map(
  ([
    id,
    fullLegalName,
    dateOfBirth,
    nationality,
    addressLine1,
    addressLine2,
    city,
    stateRegion,
    postalCode,
    country,
    idDocumentType,
    idProofNumber,
    email,
    phone,
    riskFlags,
    customerStatus,
    internalNotes,
  ]) => ({
    id,
    fullLegalName,
    dateOfBirth,
    nationality,
    addressLine1,
    addressLine2,
    city,
    stateRegion,
    postalCode,
    country,
    idDocumentType,
    idProofNumber,
    email,
    phone,
    riskFlags: [...riskFlags],
    customerStatus,
    internalNotes,
  }),
);

function norm(s: string | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normId(s: string | undefined): string {
  return (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function nameTokens(name: string): Set<string> {
  return new Set(norm(name).split(/\s+/).filter((t) => t.length > 1));
}

function nameOverlapScore(a: string, b: string): number {
  const A = nameTokens(a);
  const B = nameTokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let hit = 0;
  for (const t of A) {
    if (B.has(t)) hit += 1;
  }
  return hit / Math.max(A.size, B.size);
}

function maskIdProof(id: string): string {
  const t = id.replace(/\s/g, '');
  if (t.length <= 6) return '****';
  return `${t.slice(0, 3)}…${t.slice(-4)}`;
}

export type RegistryLookupInput = {
  fullLegalName?: string;
  dateOfBirth?: string;
  nationality?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  country?: string;
  idDocumentType?: string;
  idProofNumber?: string;
  email?: string;
  phone?: string;
};

export type FieldDiscrepancy = {
  field: string;
  submitted?: string;
  onFile?: string;
  note: string;
};

export type RegistryMatch = {
  recordId: string;
  matchScore: number;
  recordSummary: string;
  customerStatus: RegistryRecord['customerStatus'];
  riskFlagsOnFile: string[];
  discrepancies: FieldDiscrepancy[];
  /** Key fields returned for reviewer visibility (synthetic demo values). */
  onFileSnapshot: Pick<
    RegistryRecord,
    | 'fullLegalName'
    | 'dateOfBirth'
    | 'nationality'
    | 'addressLine1'
    | 'addressLine2'
    | 'city'
    | 'stateRegion'
    | 'postalCode'
    | 'country'
    | 'idDocumentType'
    | 'idProofNumber'
    | 'email'
    | 'phone'
  >;
};

/**
 * Deterministic fuzzy match against {@link SAMPLE_REGISTRY} for demo verification.
 */
export function lookupRegistry(input: RegistryLookupInput): {
  matches: RegistryMatch[];
  registrySize: number;
} {
  const submittedName = input.fullLegalName ?? '';
  const submittedDob = norm(input.dateOfBirth ?? '').replace(/\s/g, '');
  const submittedCountry = norm(input.country ?? '');
  const submittedCity = norm(input.city ?? '');
  const submittedPin = norm(input.postalCode ?? '').replace(/\s/g, '');
  const submittedAddr = norm(input.addressLine1 ?? '');
  const submittedAddr2 = norm(input.addressLine2 ?? '');
  const submittedState = norm(input.stateRegion ?? '');
  const submittedNationality = norm(input.nationality ?? '');
  const submittedIdType = norm(input.idDocumentType ?? '');
  const submittedIdNum = normId(input.idProofNumber);
  const submittedEmail = norm(input.email ?? '');
  const submittedPhone = norm(input.phone ?? '').replace(/\s/g, '');

  const scored: RegistryMatch[] = [];

  for (const r of SAMPLE_REGISTRY) {
    let score = 0;
    const discrepancies: FieldDiscrepancy[] = [];

    const no = nameOverlapScore(submittedName, r.fullLegalName);
    score += no * 40;
    if (submittedName && no < 0.34) {
      discrepancies.push({
        field: 'fullLegalName',
        submitted: submittedName,
        onFile: r.fullLegalName,
        note: 'Low token overlap with registry name.',
      });
    }

    const rDob = norm(r.dateOfBirth).replace(/\s/g, '');
    if (submittedDob && rDob) {
      if (submittedDob === rDob) {
        score += 35;
      } else if (no > 0.5) {
        discrepancies.push({
          field: 'dateOfBirth',
          submitted: input.dateOfBirth,
          onFile: r.dateOfBirth,
          note: 'DOB on file differs from submission for similar name.',
        });
      }
    }

    if (submittedCountry && norm(r.country) === submittedCountry) {
      score += 8;
    } else if (submittedCountry && no > 0.5) {
      discrepancies.push({
        field: 'country',
        submitted: input.country,
        onFile: r.country,
        note: 'Country mismatch vs registry candidate.',
      });
    }

    if (submittedCity && norm(r.city) === submittedCity) {
      score += 7;
    }

    if (submittedPin && norm(r.postalCode).replace(/\s/g, '') === submittedPin) {
      score += 6;
    }

    if (submittedAddr && norm(r.addressLine1).includes(submittedAddr.slice(0, 8))) {
      score += 4;
    }

    if (submittedAddr2 && norm(r.addressLine2) && norm(r.addressLine2) === submittedAddr2) {
      score += 2;
    }

    if (submittedState && norm(r.stateRegion) === submittedState) {
      score += 3;
    }

    if (submittedNationality && norm(r.nationality) === submittedNationality) {
      score += 5;
    } else if (submittedNationality && no > 0.45 && norm(r.country) === submittedCountry) {
      discrepancies.push({
        field: 'nationality',
        submitted: input.nationality,
        onFile: r.nationality,
        note: 'Nationality differs from registry candidate for same geography.',
      });
    }

    const rId = normId(r.idProofNumber);
    if (submittedIdNum && rId) {
      if (submittedIdNum === rId) {
        score += 28;
      } else if (no > 0.45) {
        discrepancies.push({
          field: 'idProofNumber',
          submitted: maskIdProof(input.idProofNumber ?? ''),
          onFile: maskIdProof(r.idProofNumber),
          note: 'ID reference does not match registry candidate.',
        });
      }
    }

    if (submittedIdType && norm(r.idDocumentType).includes(submittedIdType)) {
      score += 3;
    }

    if (submittedEmail && norm(r.email) === submittedEmail) {
      score += 4;
    }

    if (submittedPhone && norm(r.phone).replace(/\s/g, '') === submittedPhone) {
      score += 4;
    }

    const discForRecord: FieldDiscrepancy[] = [...discrepancies];
    if (score < 12) continue;

    const snap = {
      fullLegalName: r.fullLegalName,
      dateOfBirth: r.dateOfBirth,
      nationality: r.nationality,
      addressLine1: r.addressLine1,
      addressLine2: r.addressLine2,
      city: r.city,
      stateRegion: r.stateRegion,
      postalCode: r.postalCode,
      country: r.country,
      idDocumentType: r.idDocumentType,
      idProofNumber: r.idProofNumber,
      email: r.email,
      phone: r.phone,
    };

    scored.push({
      recordId: r.id,
      matchScore: Math.round(score * 10) / 10,
      recordSummary: `${r.fullLegalName} | DOB ${r.dateOfBirth} | ${r.addressLine1}${r.addressLine2 ? ', ' + r.addressLine2 : ''} | ${r.city}, ${r.stateRegion} ${r.postalCode}, ${r.country} | ${r.idDocumentType} ${maskIdProof(r.idProofNumber)} | ${r.email} | status=${r.customerStatus}`,
      customerStatus: r.customerStatus,
      riskFlagsOnFile: [...r.riskFlags],
      discrepancies: discForRecord,
      onFileSnapshot: snap,
    });
  }

  scored.sort((a, b) => b.matchScore - a.matchScore);
  const top = scored.slice(0, 5);

  return { matches: top, registrySize: SAMPLE_REGISTRY.length };
}
