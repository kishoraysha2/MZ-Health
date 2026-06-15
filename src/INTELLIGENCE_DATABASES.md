# MZ Health - Medicine & Disease Intelligence Database Specification
## Document Metadata
* **Project Name:** MZ Health
* **Entity:** MZ Systems (Bangladesh)
* **Author:** Senior Healthcare Data Architect
* **Date:** June 13, 2026
* **Database Platform:** Google Cloud Firestore (Native Mode) with Offline-First Synchronization
* **Standards Framework:** DGDA (Bangladesh) & WHO ICD-11

---

## 1. Executive Preface: Bangladesh Healthcare Context
This architecture specifies the **Medicine Intelligence Database** and **Disease Intelligence Database** for MZ Health MVP. In Bangladesh, pharmaceutical databases must align with the regulatory parameters of the **Directorate General of Drug Administration (DGDA)**. This involves capturing unified Generic drug names, specialized commercial preparations (such as Allopathic versus Herbal/Unani/Ayurvedic variations where applicable), and specific localized regulatory licensing details (such as DGDA DAR/Registration numbers).

Furthermore, the database is optimized to solve local market realities:
* **High Brand Substitution:** Patients frequently need equivalent medicines due to localized distributor stockouts.
* **Bilingual Interaction:** Prescriptions are compiled in English, but patients, pharmacy workers, and assistants often query systems in phonetic Bangla script or direct Bengali translations.
* **Bandwidth & Offline Realities:** Rural community clinics require durable offline access to therapeutic guidelines, drug-drug compatibility charts, and dosage tables without persistent internet connections.

---

## 2. Collection Structure & Flat Schema Architecture

Consistent with high-scale NoSQL paradigms, we utilize top-level root collections rather than nested subcollections for core datasets. This prevents deep retrieval path bottlenecks, allows granular indexing, and ensures efficient localized data synchronization.

```text
/ (Database Root)
├── medicines (Collection) — [Estimated Size: 80,000+ active brands in Bangladesh]
│   └── {medicineId} (Document)
└── diseases (Collection) — [Estimated Size: 22,000+ clinical codes in ICD-11]
    └── {diseaseId} (Document)
```

---

## 3. Firestore Schema: Medicine Intelligence Database

The `medicines` collection tracks all commercial products registered and licensed for manufacturing, import, and distribution within Bangladesh.

### `medicines` Collection Document
* **Document ID Strategy:** Clean alphanumeric slug matching the pattern: `{manufacturer_short_code}-{brand_slug}-{strength_slug}` (e.g., `square-napa-extend-665mg`). This maintains global uniqueness while supporting deterministic cache lookups.

```typescript
interface MedicineIntelligenceDocument {
  // --- Core Identification & Localization ---
  medicineId: string;                   // Document ID (Primary Key)
  brandNameEng: string;                 // English brand designation (e.g., "Napa Extend")
  brandNameBng: string;                 // Bengali trade name script (e.g., "নাপা এক্সটেন্ড")
  genericName: string;                  // Standard generic scientific compound (e.g., "Paracetamol")
  genericId: string;                    // Normalized generic class identifier for cross-referencing
  strength: string;                     // Accurate payload strength representation (e.g., "665 mg")
  dosageForm: 'tablet' | 'capsule' | 'syrup' | 'injection' | 'inhaler' | 'ointment' | 'drops' | 'suspension' | 'suppository'; 
  
  // --- Manufacturer & Corporate Mapping ---
  manufacturer: {
    companyId: string;                  // References pharma_companies/{companyId}
    nameEng: string;                    // Copied for fast UI card display (e.g., "Square Pharmaceuticals PLC")
    nameBng: string;                    // Bengali company name (e.g., "স্কয়ার ফার্মাসিউটিক্যালস")
  };

  // --- Clinical Categorization & Therapeutic Index ---
  category: {
    primaryDepartment: string;          // Clinical division (e.g., "General Medicine", "Cardiology")
    therapeuticClass: string;           // Anatomical Therapeutic Chemical (ATC) category
    subTherapeuticClass?: string;       // Secondary ATC subcategory
  };

  // --- Commerce & Pricing Models ---
  price: {
    unitPriceBdt: number;               // Retail price per single tablet/vial (e.g., 2.50)
    packPriceBdt: number;               // Retail price per entire wholesale container (e.g., 250.00)
    minOrderQty: number;                // Pack/unit sizing rules for pharmacy audits
  };

  // --- Detailed Clinical Information (Structured) ---
  indications: string[];                // Multi-entry list of physical symptoms addressed (e.g., ["acute headache", "fever"])
  indicationsBng: string[];             // Translated symptoms for client reference (e.g., ["তীব্র মাথাব্যথা", "জ্বর"])
  contraindications: string[];          // Structural conditions blocking safety (e.g., "Severe hepatic impairment")
  sideEffects: string[];                // Common adverse reactions (e.g., ["Nausea", "Allergic reaction"])
  pregnancyCategory: 'A' | 'B' | 'C' | 'D' | 'X' | 'N'; // FDA Regulatory Safety Rating
  lactationCategory: 'safe' | 'caution' | 'unsafe' | 'unknown'; // Pediatric breastmilk compatibility rating
  storageConditions: string;            // Physical safety parameters (e.g., "Store below 30°C in a dry place, protect from light")
  
  // --- Clinical Dosing Instructions ---
  dosageRules: {
    adultDosage: string;                // Primary instructions (e.g., "665 mg to 1.3 g orally every 8 hours as needed, max 4 g/day")
    adultDosageBng: string;             // Bengali patient translation
    childDosage?: string;               // Pediatric metric calculations
    childDosageBng?: string;           // Pediatric Bengali patient translation
  };

  // --- Dynamic Medical Interactions & Warnings ---
  drugInteractions: Array<{
    targetGenericId: string;            // Generic ID of compound that creates hazard
    targetGenericName: string;          // Name representing interactive medicine
    severity: 'minor' | 'moderate' | 'major' | 'contraindicated'; // Level of physical risk
    clinicalDescription: string;        // Narrative detail describing physical outcome
  }>;

  // --- Related / Alternative Medicine Arrays (Self-Healed References) ---
  relationshipIdentifiers: {
    alternativeMedicineIds: string[];   // Array of equivalent medicineIds from competitive manufacturers with same generic & strength
    similarGenericMedicineIds: string[];// MedicineIds containing alternative generics in the same therapeutic class
  };

  // --- Physical Assets, Barcodes & Verification ---
  commercialMetadata: {
    barcodes: string[];                 // EAN-13, GS1, or UPC packaging codes
    darNum: string;                     // Officially designated DGDA DAR / Drug Registration Number (e.g., "025-242-065")
    dgdaApprovalDate: Timestamp;        // Date licensing was completed
    isActive: boolean;                  // Administrative availability toggle (true means active, false means banned/recalled)
  };

  // --- Global Intelligent Query Properties ---
  searchTokens: string[];               // Specialized lookup indexes (e.g., ["nap", "napa", "napaex", "para", "parac"])
  bengaliSearchTokens: string[];        // Specialized Bengali indexes (e.g., ["নাপ", "নাপা", "প্যারা", "প্যারাসি"])
  vectorEmbeddingVersion?: string;      // Placeholder version representing local LLM generation run
  
  createdAt: Timestamp;                 // Database creation marker
  updatedAt: Timestamp;                 // Database update marker
}
```

---

## 4. Firestore Schema: Disease Intelligence Database

The `diseases` collection serves as a clinical knowledge engine containing localized diagnostic metadata mapped directly to generic and commercial therapeutic pathways.

### `diseases` Collection Document
* **Document ID Strategy:** Alphanumeric ID matching standard WHO classifications: `icd11-{code}` (e.g., `icd11-1b10` for Tuberculosis) or `icd10-{code}` (e.g., `icd10-i10` for Essential Hypertension).

```typescript
interface DiseaseIntelligenceDocument {
  // --- Core Nosology Mappings ---
  diseaseId: string;                    // Document ID (Primary key mapped to standard classification)
  icdCode: string;                      // Main standard reference clinical code
  icdVersion: 'ICD-10' | 'ICD-11';      // International Classification of Diseases standard baseline
  nameEng: string;                      // Official medical English term (e.g., "Essential Primary Hypertension")
  nameBng: string;                      // Official local medical Bengali term (e.g., "প্রাইমারি হাইপারটেনশন / উচ্চ রক্তচাপ")
  diseaseCategory: string;              // High-level grouping (e.g., "Diseases of the circulatory system")
  
  // --- Clinical Definitions ---
  severityLevel: 'low' | 'moderate' | 'high' | 'critical'; // Care prioritization classification
  emergencyWarningIndicators: string[]; // Absolute red flag criteria (e.g., ["Chest pain", "Sudden numbness"])
  emergencyWarningIndicatorsBng: string[]; // Red flags in local script (e.g., ["বুকে ব্যথা", "শরীরের কোনো অংশে অবশ ভাব"])

  // --- Comprehensive Medical Narrative ---
  symptoms: string[];                   // Primary clinical presentations (e.g., ["Headache", "Blurred vision"])
  symptomsBng: string[];                // Physical presentations in Bengali (e.g., ["মাথাব্যথা", "ঝাপসা দৃষ্টি"])
  causes: string[];                     // Etiological pathways (e.g., ["Genetic predisposition", "High sodium diet"])
  riskFactors: string[];                // Accelerants (e.g., ["Obesity", "Smoking", "Age"])
  prevention: string[];                 // Non-pharmacological preventative recommendations (e.g., ["Regular exercise", "Sodium reduction"])
  preventionBng: string[];              // Non-pharmacological actions in Bengali (e.g., ["নিয়মিত ব্যায়াম", "লবণ কম খাওয়া"])

  // --- Healthcare Routing & Referral Index ---
  routingMetadata: {
    recommendedSpecialists: string[];   // Expert disciplines, matches doctors.specialties (e.g., ["Cardiology", "Internal Medicine"])
    careFacilityTier: 'primary_clinic' | 'secondary_hospital' | 'tertiary_medical_college'; // Medical tier assignment
  };

  // --- Drug Formula Interlocking (Generic Mapping) ---
  treatmentGuidelines: {
    firstLineGenerics: Array<{
      genericId: string;                // References medicines.genericId
      genericName: string;              // Standard generic scientific term
      clinicalNotes: string;            // Context-specific clinical guidance
    }>;
    secondLineGenerics: Array<{
      genericId: string;
      genericName: string;
      clinicalNotes: string;
    }>;
  };

  // --- Relational Graph Indexes ---
  relationshipIdentifiers: {
    relatedDiseaseIds: string[];        // Array linking directly to other diseaseIds (co-morbidities)
    complications: string[];            // Structural clinical developments (e.g., "Myocardial Infarction")
  };

  // --- Search & Auditing ---
  searchTokens: string[];               // Token indexing for fast lookup prefix structures
  bengaliSearchTokens: string[];        // Bengali token indexing for scripts
  createdAt: Timestamp;                 // Creation time
  updatedAt: Timestamp;                 // Modification time
}
```

---

## 5. Relationships Between Diseases & Medicines

Because Firestore is a NoSQL document database, direct physical Joins are not supported. Relational connectivity is explicitly managed through **Id Referencing** and **Controlled Denormalization** to prevent queries from making sequential network roundtrips during critical clinical workflows (e.g., writing an E-Prescription).

### Data Interaction Flow
```text
  +---------------------------------+             +---------------------------------+
  |        DISEASES Collection      |             |       MEDICINES Collection      |
  +---------------------------------+             +---------------------------------+
  | - diseaseId: icd10-i10          |             | - medicineId: square-napa-500mg |
  | - nameEng: Hypertension         |             | - brandNameEng: Napa 500mg      |
  | - treatmentGuidelines:          |             | - genericName: Paracetamol      |
  |   - firstLineGenerics:          |             | - genericId: gen-paracetamol    |
  |     - genericId: gen-amlodipine |             +----------------+----------------+
  +----------------+----------------+                              |
                   |                                               | Matches genericId
                   | References genericId                          | 
                   +------------------------+----------------------+
                                            |
                                            v Cross-Reference Index
                               +----------------------------+
                               |     PRESCRIPTION ENGINE    |
                               +----------------------------+
                               | - Validates therapeutic    |
                               |   compatibility            |
                               | - Flags contraindications  |
                               +----------------------------+
```

### Relationship Enforcement Protocols
1. **Generic ID Decoupling:** To prevent active medicine brand additions/removals from constantly altering `disease` files, the `diseases` database does *not* store individual brand IDs. Instead, it links to generic codes inside `treatmentGuidelines.firstLineGenerics[*].genericId`. The client application can fetch competitive brands dynamically from the `medicines` collection with a simple query:
   ```typescript
   // Find all active products matching indicated generic class
   firestore.collection('medicines')
     .where('genericId', '==', targetGenericId)
     .where('commercialMetadata.isActive', '==', true);
   ```
2. **Denormalized Copying inside Prescriptions:** When a prescription is formulated (Module 9), details of both the chosen medicine and the diagnostic disease are completely duplicated into the transaction payload. Even if a pharmacy manufacturer alters the dosage form or price of a product, historical safety logs are protected from retroactive altering.

---

## 6. Bilingual Search Architecture: English and Bengali

Developing search functionality for Bangladesh requires concurrent parsing of distinct writing scripts. We specify a dual-script architecture using **Client-Side Tokenization**, **Phonetic Hashing**, and **Transliteration Maps** executed directly within Firestore without the overhead and synchronization lag of external index sync configurations.

### 1. Sequential Suffix/Prefix Tokenization
When saving a drug formulation (e.g., "Napa 500mg") or clinical condition (e.g., "Lactose Intolerance"), a database write trigger generates lowercase progressive token variations:
* **English Word:** `"Napa"` $\rightarrow$ `['n', 'na', 'nap', 'napa']`
* **Bengali Word:** `"নাপা"` $\rightarrow$ `['ন', 'না', 'নাপ', 'নাপা']`

```typescript
function generateSearchTokens(...words: string[]): string[] {
  const tokens = new Set<string>();
  for (const word of words) {
    const cleanWord = word.trim().toLowerCase();
    for (let i = 1; i <= cleanWord.length; i++) {
      tokens.add(cleanWord.substring(0, i));
    }
  }
  return Array.from(tokens);
}
```
These arrays are updated under the `searchTokens` and `bengaliSearchTokens` document properties. Firestore queries match these exactly:
```typescript
// Fast real-time prefix search as the doctor types
firestore.collection('medicines')
  .where('bengaliSearchTokens', 'array-contains', partialInputString)
  .limit(10);
```

### 2. Phonetic Equivalency Matching (Bangla-to-English Transliteration)
Users routinely type Bengali pronunciation values using standard Latin characters (e.g., writing "Daktar" or "Jor" instead of "Doctor" or "Fever"). To match these:
* We maintain a lightweight phonetic map at the client side that transforms Latin alphabet translations into Bengali character sequences.
* Secondary search properties represent phonetically cleaned configurations (Soundex or Metaphone keys tailored for Bengali phonology structures).

---

## 7. Indexing Specifications & Execution Rules

To guarantee predictable query performance at low operational cost, specific indexes must be applied.

```json
{
  "indexes": [
    {
      "collectionGroup": "medicines",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "commercialMetadata.isActive", "order": "ASCENDING" },
        { "fieldPath": "genericId", "order": "ASCENDING" },
        { "fieldPath": "dosageForm", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "medicines",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "commercialMetadata.isActive", "order": "ASCENDING" },
        { "fieldPath": "searchTokens", "arrayConfig": "CONTAINS" },
        { "fieldPath": "price.unitPriceBdt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "diseases",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "severityLevel", "order": "ASCENDING" },
        { "fieldPath": "searchTokens", "arrayConfig": "CONTAINS" }
      ]
    }
  ]
}
```

---

## 8. Scalability Plan for 100,000+ Records & Offline-First Sync

Serving 100k+ structured records to low-tier smartphones across Bangladesh requires an explicit data size management regimen.

### 1. Subsequence Document Splitting
While the main intelligence search document (incorporating indications, dosing, and full clinical text) can approach ~200 KB, mobile clients during rapid searches only require lightweight descriptors (Brand Name, Strength, Form, Price, Active Status). We enforce a **Two-Tier Document Schema Partition**:

```text
/medicines (Main Collection)
   └── {medicineId} (Full documentation, clinical contraindications, side effects)

/medicine_catalogs (Shallow Search Collection)
   └── {medicineId} (Contains only: brandNameEng, brandNameBng, strength, price, company name, searchTokens)
```
* **Impact:** The search indexes are extremely lightweight (~1 KB per row), ensuring mobile local disk caches can hold the entire 100,000 index payload in < 100 MB of persistent local device capacity, while the larger medical instructions are loaded on-demand.

### 2. Immutable Cache Sync with Delta Versioning
To prevent constant full queries on startup, the system implements an incremental update model using **Delta Timestamps**:
* Each medical metadata update increments a regional version counter.
* Upon establishing a database connection, the client device reads a single local sync document to evaluate if updates exist:
  ```typescript
  // Synchronizes only modified elements since last synchronization pass
  const localLastSyncDate = getStoredLocalTimestamp();
  firestore.collection('medicine_catalogs')
    .where('updatedAt', '>', localLastSyncDate)
    .get();
  ```
* **Offline-First Resilience:** Firestore Native SDK reads database structures directly from the local disk cache (`getDocsFromCache()`) during poor rural connection drops.

---

## 9. Future AI Compatibility & E-Prescription Alignment

MZ Health is architected to integrate seamlessly with deep predictive AI engines (such as Gemini models) and E-Prescription modules in later stages.

### 1. AI-Driven Smart Diagnostics Inputs
* The structured nature of clinical symptoms arrays (`diseases.symptoms`) and ICD classification mappings acts as an explicit schema template.
* AI Assistants can ingest the localized Bengali and English indicators directly as prompt parameters, returning relevant indicated ICD-11 diseases with predictable precision.
* Placeholder fields (`vectorEmbedding` arrays of $768$/$1536$ dimensions) are reserved to index medicines and diseases for vector similarity searches using Firestore vector index techniques near-term.

### 2. E-Prescription Safety Interlock Hooks
The Medicine Database structure incorporates explicit safety flags to guide the prescription generation module:
* **`isPrescriptionRequired`:** Triggers restricted patient checkouts in order flows.
* **`drugInteractions.severity == 'contraindicated'`:** An immediate code validator triggers warnings directly inside the physician's prescription interface if incompatible products are assigned together.
* **`pregnancyCategory`:** Flag mechanics generate real-time alerts if are assigned to patients with registered prenatal demographics.

---
**Approved & Signed By:**
*Senior Healthcare Data Architect, MZ Systems*
