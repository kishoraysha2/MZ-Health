# Bangladesh Pharmaceutical Registry & Data Import Foundation (BMIS)
## Sprint 3B: Database Schemas, Pipeline Architecture & Integrity Specifications

**Authors:** Chief Healthcare Architect, Senior Firebase Architect, Bangladesh Healthcare Systems Architect, DGDA Compliance Architect  
**Status:** Frozen & Approved for Implementation  
**Version:** 3.1.0  

---

## 1. Architectural Overview & Design Pattern
To support **100,000+ medicines**, **5,000+ generic concepts**, and **1,000+ pharmaceutical manufacturers** processing operations under a high concurrent load of **10 million+ Bengalee citizens**, the architecture must be normalized and decoupled. 

We transition the flat, redundancy-prone design of early models to a multi-parent relational hierarchy mapped to Firebase Firestore collections.

This blueprint establishes:
1. **The Four-Tier Relational Chain**:
   $$\text{pharmaceutical\_companies} \rightarrow \text{medicine\_generics} \rightarrow \text{medicines} \rightarrow \text{medicine\_catalogs}$$
2. **Bulk Data Ingestion & Queue Pipeline**: A zero-locking, chunked import queue.
3. **DGDA Compliance Core**: Real-time regulatory alerts, manufacturing suspensions, and chronological pricing audit trail subcollections.

---

## 2. Normalized Firestore Schemas (Zustand/Service Layer Compositions)

### 2.1 Collection: `pharmaceutical_companies`
Holds the regulatory identity of manufacturers approved by the Directorate General of Drug Administration (DGDA) of Bangladesh.

```typescript
export interface PharmaceuticalCompany {
  companyId: string;                     // Unique DGDA-compliant key (e.g., "PC-SQUARE", "PC-BEXIMCO")
  companyNameEnglish: string;            // Standard English name (e.g., "Square Pharmaceuticals PLC")
  companyNameBengali: string;            // Standard Bengali name (e.g., "স্কয়ার ফার্মাসিউটিক্যালস পিএলসি")
  companyShortName: string;              // Standard pharmaceutical suffix (e.g., "Square")
  companyLogoUrl: string;                // Secure Cloud Storage URL for corporate logo
  website: string;                       // Official website URI
  headquarters: string;                  // Primary physical manufacturing location in Bangladesh
  foundedYear: number;                   // Year of founding
  dgdaRegistrationNumber: string;        // Official government drug manufacturing license ID (e.g., "DGDA-MFG-382")
  companyStatus: 'active' | 'suspended' | 'inactive'; // Suspended state blocks all child medicine prescriptions
  createdAt: string;                     // ISO 8601 Timestamp of database entry
  updatedAt: string;                     // ISO 8601 Timestamp of database update
}
```

### 2.2 Collection: `medicine_generics`
The central scientific foundation. Normalizing generics prevents clinical description duplication, reduces write hotspots, and isolates core monograph references from retail brands.

```typescript
export interface MedicineGeneric {
  genericId: string;                     // Unique drug compound key (e.g., "GEN-PARACETAMOL", "GEN-ESOMEPRAZOLE")
  genericNameEnglish: string;            // English scientific name (e.g., "Paracetamol")
  genericNameBengali: string;            // Bengali scientific name (e.g., "প্যারাসিটামল")
  therapeuticClass: string;              // Pharmacological class (e.g., "Analgesics & Antipyretics")
  indications: string[];                 // Approved clinical applications
  contraindications: string[];           // Physical exclusion criteria
  sideEffects: string[];                 // Known physiological adverse secondary effects
  pregnancyCategory: 'A' | 'B' | 'C' | 'D' | 'X' | 'N/A'; // FDA Pregnancy Class
  lactationCategory: 'safe' | 'caution' | 'contraindicated' | 'unknown';
  drugInteractions: string[];            // Notable combination risks
  status: 'active' | 'suspended';        // Global recall state forces prescription-blocking on all generic products
  createdAt: string;                     // ISO 8601 Timestamp
  updatedAt: string;                     // ISO 8601 Timestamp
}
```

### 2.3 Collection: `medicines`
Describes the physical consumer product formulation context. Each medicine represents a specific commercial formulation associated with a manufacturer and a functional generic code.

```typescript
export interface Medicine {
  medicineId: string;                    // Unique brand SKU (e.g., "MED-NAPA-TAB-500", "MED-ACE-TAB-500")
  brandNameEnglish: string;              // Registered trading name (e.g., "Napa")
  brandNameBengali: string;              // Registered trading name in Bengali (e.g., "নাপা")
  genericId: string;                     // Foreign Key pointer matching `medicine_generics.genericId`
  manufacturerId: string;                // Foreign Key pointer matching `pharmaceutical_companies.companyId`
  strength: string;                      // Dosage strength metadata (e.g., "500 mg", "10 mg/5 ml")
  dosageForm: string;                    // Physical shape/vessel (e.g., "Tablet", "Suspension", "Inhaler")
  packSize: string;                      // Unit packing presentation (e.g., "10 x 10's", "100ml Bottle")
  unitPrice: number;                     // Current BDT retail unit price (regulated by the government)
  storageConditions: string;             // Storage criteria mapping (e.g., "Keep below 30°C")
  requiresPrescription: boolean;         // OTC status boolean representation (True = POM, False = OTC)
  alternativeMedicines: string[];         // Direct pointer IDs to matching competitive medications of identical genericId
  searchTokens: string[];                // Calculated multi-language indexing arrays
  bengaliSearchTokens: string[];         // Calculated Bengali indexing arrays
  createdAt: string;                     // ISO 8601 Timestamp
  updatedAt: string;                     // ISO 8601 Timestamp
}
```

### 2.4 Collection: `medicine_catalogs`
Speed projection optimization. Compact metadata ensures queries extract minimal network payloads during rapid dynamic search input dropdowns.

```typescript
export interface MedicineCatalog {
  medicineId: string;                    // Foreign Key pointing to `medicines.medicineId`
  brandName: string;                     // Default interface brand text representation
  genericName: string;                   // Denormalized generic text for seamless single-fetch matching
  manufacturerName: string;              // Denormalized company short name
  strength: string;                      // Formulation strength representation
  dosageForm: string;                    // Form factor 
  unitPrice: number;                     // Display price in Taka
  searchTokens: string[];                // Scalable search prefix components
  bengaliSearchTokens: string[];         // Bengali search prefix components
}
```

---

## 3. Regulatory Collections

### 3.1 Collection: `drug_regulatory_alerts`
Enforces rapid nationwide clinical bans, notices, and product audits issued by DGDA.

```typescript
export interface DrugRegulatoryAlert {
  alertId: string;                       // System reference identification (e.g., "ALT-2026-004")
  severity: 'info' | 'warning' | 'critical' | 'recall'; // 'recall' disables UI-prescribing streams
  affectedGenericId: string | null;      // Optional global chemical link trigger
  affectedManufacturerId: string | null; // Optional company-wide quarantine block
  detailsEnglish: string;                // Technical English announcement detail
  detailsBengali: string;                // Technical Bengali translation detail
  publishedAt: string;                   // ISO 8601 Announcement DateTime
}
```

### 3.2 Subcollection: `/medicines/{medicineId}/pricing_history`
To safeguard pricing integrity and track compliance with the statutory pricing controls, brand price modifications generate structured timeline logs rather than simple value overwrites.

```typescript
export interface PricingHistory {
  price: number;                         // Historical unit price in BDT
  effectiveDate: string;                 // Date from which the price was mandated
  updatedBy: string;                     // Reference identifying the admin modifier
}
```

---

## 4. Medicine Relationship Architecture & Entity Map

```
+------------------------------------+
|      pharmaceutical_companies      |
+------------------------------------+
| PK: companyId [1]                  |
+-----------------+------------------+
                  |
                  | 1-to-Many
                  |
                  v [N]
+------------------------------------+      +------------------------------------+
|               medicines            |<-----+          medicine_generics         |
+------------------------------------+      +------------------------------------+
| PK: medicineId [1]                 |      | PK: genericId [1]                  |
| FK: manufacturerId [N]             |      | 1-to-Many with medicines [N]        |
| FK: genericId      [N]             |      +-----------------+------------------+
+-----------------+------------------+                        |
                  |                                           |
                  | 1-to-1                                    | 1-to-Many (Cascade)
                  |                                           |
                  v [1]                                       v [N]
+------------------------------------+      +------------------------------------+
|          medicine_catalogs         |      |       drug_regulatory_alerts       |
+------------------------------------+      +------------------------------------+
| PK: medicineId                     |      | PK: alertId                        |
+------------------------------------+      | FK: affectedGenericId (Nullable)   |
                                            | FK: affectedManufacturerId (Null)  |
                                            +------------------------------------+
```

---

## 5. Data Import Pipeline Architecture (Zero-Locking)

```
 [CLIENT INGESTION ENGINE] 
 (CSV / Excel / JSON upload)
           |
           v
 [STREAM READER ENGINE] ────> (Chunk Payload into sets of 500)
           |
           v
 [SECURITY / INTEGRITY GATEWAY] (Check Schema Validation Rules)
           |
           |-- IF FAIL: Mark Queue Row Failed (Details to Import Logs)
           |
           +-- IF PASS ────> [BATCH WRITER ENGINE] (Firestore Transactions)
                                     |
                                     ├── Write `medicines/{id}`
                                     └── Write `medicine_catalogs/{id}`
```

### 5.1 Collection: `import_jobs`
Durable ingestion lifecycle. Allows distributed tracking of asynchronous background operations.

```typescript
export interface ImportJob {
  jobId: string;                         // Ingestion reference sequence UUID
  importType: 'batch' | 'api' | 'manual';
  sourceType: 'csv' | 'excel' | 'json' | 'manual';
  fileName: string;                      // Raw file reference (e.g., "dgda_import_q2_2026.csv")
  totalRecords: number;                  // Declared total rows inside payload
  successfulRecords: number;             // Successfully processed record count
  failedRecords: number;                 // Rejected record count (due to schema or foreign keys)
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdBy: string;                     // ID of importing system operator
  startedAt: string;                     // ISO 8601 Timestamp of pipeline boot
  completedAt: string | null;            // Completion or termination date anchor
}
```

---

## 6. Real-time Ingestion Validation Rules

Before initiating Firestore transaction batches, raw input payloads are routed through a dry-run validation script to confirm DGDA structural integrity.

| Rule ID | Target Vector | Validation Assertion Constraint | Target Resolution Action |
|:---|:---|:---|:---|
| **V-GEN-01** | `genericId` | Must match target pointer inside existing `/medicine_generics` collection. | Halt current row, queue to `failed_logs`. |
| **V-MFG-02** | `manufacturerId` | Must match target pointer inside `/pharmaceutical_companies` directory. | Halt current row, reject row index. |
| **V-VAL-03** | `unitPrice` | Price value MUST be a numeric float $> 0.00$. Zero values block transaction entry. | Reject row, throw numeric error. |
| **V-FMT-04** | `strength` | Regex check target patterns: `^([0-9.]+)\s*(mg|g|ml|mcg|IU|%|mg/ml|mg/g)$` (case-insensitive). | Flag non-standard dosage patterns for verification. |
| **V-DUP-05** | Double Mapping | Combine tracking keys `(brandNameEnglish + strength + dosageForm + manufacturerId)`. Checks for existing identity. | Skip duplicate, trigger system UPDATE transaction. |

---

## 7. Composite Indexes for National Scale Searching

To optimize performance on multiple fields and handle pagination across pharmaceutical records, the following composite indexes are requested:

```json
{
  "indexes": [
    {
      "collectionGroup": "medicines",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "manufacturerId", "order": "ASCENDING" },
        { "fieldPath": "genericId", "order": "ASCENDING" },
        { "fieldPath": "unitPrice", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "medicines",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "requiresPrescription", "order": "ASCENDING" },
        { "fieldPath": "brandNameEnglish", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## 8. Search Preparation Engine (Prefix & Phonetics)

To ensure maximum performance during queries of **100,000+ items** from typical consumer-grade network settings in Bangladesh:

### 8.1 English/Bengali Prefix Indexing Strategy
We parse string metadata into multi-lingual search arrays on document write. For example, registering **"Napa Rapid"** updates `/medicines/{medicineId}` arrays with:

```typescript
// English Ingestion Mapping Array (searchTokens)
searchTokens: [
  "n", "na", "nap", "napa",
  "r", "ra", "rap", "rapi", "rapid",
  "paracetamol", "para", "parac" // Copied generic terms for unified search
]

// Bengali Ingestion Mapping Array (bengaliSearchTokens)
bengaliSearchTokens: [
  "ন", "না", "নাপ", "নাপা",
  "র", "রে", "রেপ", "রেপি", "রেপিড",
  "প্যারাসিটামল", "প্যা", "প্যারাসি"
]
```

### 8.2 Phonetic Mapping & Spelling Fault Protection (English-Bengali Crossing)
* **Double Metaphone**: Normalizes and indexes core brand sounds (e.g., brand names containing "C" or "K" mapped phonetically so that searching "Klofed" or "Clofed" resolves successfully).
* **Phonetic Transliteration Cache**: When a user inputs terms in Latin keystrokes (e.g., typing "Fast"), the interface references a lightweight local map of common phonetics to match Bengali keywords, enabling quick query cross-matching.

---

## 9. Next-Step System Compatibility Recommendations

The split catalog architecture maintains cross-module compatibility:
1. **Disease Intelligence**: Integrates seamlessly. Diagnosis codes track associations with normalized `genericId` pointers, suggesting relevant molecule categories.
2. **E-Prescription Engine**: Refers strictly to `/medicine_generics` for clinical prescriptions, allowing pharmacists to dispense appropriate available alternative brands securely with `alternativeMedicines[]` lookup.
3. **Telemedicine**: Integrates with clinical catalogs with low payload footprints, ensuring high performance on 3G and 4G mobile networks in remote geographical sectors of Bangladesh.
