# India driving licence samples (demo)

Synthetic/demo images for KYC ID extraction. **Not real government documents.**

## How to upload in the UI

| Upload pattern | When to use |
|----------------|-------------|
| **Front or combined** only | Single wide scan (front left + back right), or front-only smart cards with address on front |
| **Front + back** separately | Classic layout (e.g. TN) where address is on the reverse |

## Sample catalogue

### ramachandhiran (Tamil Nadu) — separate front/back

| File | Notes |
|------|--------|
| `ramachandhiran-front.png` | DL TN54 20080003680 |
| `ramachandhiran-back.png` | Salem address |

| Field | Test value |
|-------|------------|
| Name | RAMACHANDHIRAN |
| DOB | 03-10-1983 |
| Address | 80, 1st Ward, Pillaiyar Kovil Street, Masinaickenpatty |
| City / State / Pin | Salem, Tamil Nadu, 636103 |
| ID proof number | TN54 20080003680 |
| Registry ID | **REG-029** |
| Email / phone | `ramachandhiran.demo@example.invalid` / `+91-70000-00129` |

---

### kathirselvam (Tamil Nadu) — combined scan

| File | Notes |
|------|--------|
| `kathirselvam-tn-front-back.png` | Front+back in one image |

| Field | Test value |
|-------|------------|
| Name | VR KATHIRSELVAM |
| DOB | 23-07-1961 |
| ID proof number | TN07 20150002653 |
| Address (back) | HIG 6/32 TNHB PHASE 2… CHENNAI 600119 |
| Valid till | 10-03-2025 |
| Registry ID | **REG-030** |
| Email / phone | `kathirselvam.demo@example.invalid` / `+91-70000-00130` |

---

### ashique-ali (Andaman & Nicobar) — combined

| File | Notes |
|------|--------|
| `ashique-ali-an-front-back.png` | Address on **front** |

| Field | Test value |
|-------|------------|
| Name | ASHIQUE ALI |
| DOB | 24-07-1960 |
| ID proof number | AN01 19790002088 |
| Address | MANNARGHAT P.O… SOUTH ANDAMAN 744101 |
| Registry ID | **REG-031** |
| Email / phone | `ashique.ali.demo@example.invalid` / `+91-70000-00131` |

---

### hardik-patel (Chhattisgarh) — combined

| File | Notes |
|------|--------|
| `hardik-patel-cg-front-back.png` | Address on **front**; back is Hindi safety text |

| Field | Test value |
|-------|------------|
| Name | HARDIK PATEL |
| DOB | 01-01-2002 |
| ID proof number | CG04 20210009418 |
| Address | BALAJI TIMBER BILASPUR ROAD… RAIPUR 493221 |
| Registry ID | **REG-032** |
| Email / phone | `hardik.patel.demo@example.invalid` / `+91-70000-00132` |

---

### vijaya-bharathi (Delhi NCT) — combined (DL + RC)

| File | Notes |
|------|--------|
| `vijaya-bharathi-delhi-dl-with-rc.png` | **Left half = DL**, right half = vehicle RC — extractor should ignore RC |

| Field | Test value (DL only) |
|-------|----------------------|
| Name | T VIJAYA BHARATHI |
| DOB | 15/06/1966 |
| ID proof number | DL09 20060348573 |
| Address | C 609 NEW AROHI APTS… DWARKA, SOUTH WEST DELHI 110078 |
| Registry ID | **REG-033** |
| Email / phone | `vijaya.bharathi.demo@example.invalid` / `+91-70000-00133` |

---

### vanlalnghaka (Mizoram) — combined

| File | Notes |
|------|--------|
| `vanlalnghaka-mz-front-back.png` | Smart card; address on front |

| Field | Test value |
|-------|------------|
| Name | VANLALNGHAKA |
| DOB | 28/05/1982 |
| ID proof number | MZ04 20060000532 |
| Address | MUALKAWI, CHAMPHAI DISTRICT, CHAMPHAI - 796321 |
| Registry ID | **REG-034** |
| Email / phone | `vanlalnghaka.demo@example.invalid` / `+91-70000-00134` |

---

### ajay-kumar (Uttarakhand) — combined

| File | Notes |
|------|--------|
| `ajay-kumar-uk-front-back.png` | Present address on back |

| Field | Test value |
|-------|------------|
| Name | AJAY KUMAR |
| DOB | 09-08-1991 |
| ID proof number | UK14 20210002419 |
| Address | BSF CAMP BIAAT DOIWALA, Rishikesh, Dehradun, UK, 248140 |
| Registry ID | **REG-035** |
| Email / phone | `ajay.kumar.demo@example.invalid` / `+91-70000-00135` |

---

## Adding more samples

1. Drop PNG/JPEG under this folder with a descriptive filename.
2. Add a section above with expected form test values.
3. For passport / Aadhaar, use `samples/id-cards/india-passport/` or `india-aadhaar/` when those flows are implemented.
