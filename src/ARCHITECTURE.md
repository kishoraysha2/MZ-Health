# MZ Health - MVP Version 1 Database Architecture Specification
## Document Metadata
* **Project Name:** MZ Health
* **Parent Entity:** MZ Systems (Bangladesh)
* **Author:** Senior Firebase Healthcare Architect
* **Date:** June 13, 2026
* **Database Platform:** Google Cloud Firestore (Native Mode) & Firebase Authentication

---

## 1. Collection Hierarchy

The Firestore database for MZ Health MVP v1 is designed as a shallow-to-flat hierarchy using root-level collections. This model is chosen over deep subcollection nesting to maximize query flexibility, support independent auditing, and prevent structural coupling. 

```text
/ (Database Root)
├── users (Collection)
│   └── {userId} (Document)
├── doctors (Collection)
│   └── {doctorId} (Document)
├── patients (Collection)
│   └── {patientId} (Document)
├── pharma_companies (Collection)
│   └── {companyId} (Document)
├── medicines (Collection)
│   └── {medicineId} (Document)
├── diseases (Collection)
│   └── {diseaseId} (Document)
├── appointments (Collection)
│   └── {appointmentId} (Document)
├── prescriptions (Collection)
│   └── {prescriptionId} (Document)
└── audit_logs (Collection)
    └── {logId} (Document)
```

---

## 2. Firestore Schema Definitions

### Module 1 & 2: Authentication & User Management
#### `users` Collection
* **Description:** Houses core user identities, multi-role flags, profile baselines, and security metadata. Every user has a corresponding Firebase Auth UID acting as the document ID.
* **Document ID:** `{userId}` (Matches Firebase Authentication UID)

```typescript
interface UserDocument {
  uid: string;                    // Required - Primary key, matches Firebase Auth UID
  phoneNumber: string;            // Required - Verified via mobile OTP (primary login method in Bangladesh)
  email?: string;                 // Optional - Unique secondary login method
  displayName: string;            // Required - Full human name of the user
  role: 'super_admin' | 'admin' | 'doctor' | 'patient'; // Required - Access role
  isActive: boolean;              // Required - Soft-ban/activation status
  languagePreference: 'en' | 'bn';// Required - User UI language preference
  createdAt: Timestamp;           // Required - System creation timestamp
  updatedAt: Timestamp;           // Required - System last modification timestamp
  lastLoginAt: Timestamp;         // Required - Last recorded session time
}
```

---

### Module 3: Doctor Management
#### `doctors` Collection
* **Description:** Holds profiles for verified medical practitioners. Linked 1:1 with the parent `users` collection. Includes physical chambers in Bangladesh, consultation costs, and regulatory credentials.
* **Document ID:** `{doctorId}` (Matches user UID)

```typescript
interface DoctorDocument {
  doctorId: string;               // Required - Unique Reference pointing to users/{userId}
  bmdcRegNumber: string;          // Required - Bangladesh Medical & Dental Council (BMDC) registration ID
  bmdcVerified: boolean;          // Required - Verification status of the registration by admin
  specialties: string[];          // Required - E.g., ["Cardiology", "Internal Medicine"]
  qualifications: string[];       // Required - E.g., ["MBBS", "FCPS (Cardiology)", "MD"]
  experienceYears: number;        // Required - Years of medical practice
  chambers: Array<{
    name: string;                 // Hospital/Diagnostic center name
    address: string;              // Full physical address
    city: string;                 // E.g., "Dhaka", "Chittagong", "Sylhet"
    consultationFee: number;      // Cost in BDT (Bangladesh Taka)
    activeDays: string[];         // E.g., ["Sat", "Mon", "Wed"]
    timeSlots: string[];          // E.g., ["17:00-20:00"]
  }>;                             // Required - Minimum 1 chamber required
  bio?: string;                   // Optional - Short professional summary
  totalAppointmentsCount: number; // Required - Counter cache for search ranking and metrics
  createdAt: Timestamp;           // Required - System creation timestamp
  updatedAt: Timestamp;           // Required - System last modification timestamp
}
```

---

### Module 4: Patient Management
#### `patients` Collection
* **Description:** Stores medical profile metadata, baseline demographic metrics, and blood types for emergency lookup. Linked 1:1 with `users`.
* **Document ID:** `{patientId}` (Matches user UID)

```typescript
interface PatientDocument {
  patientId: string;              // Required - Reference mapping to users/{userId}
  dateOfBirth: Timestamp;         // Required - Accurate calculation of age in prescriptions
  gender: 'male' | 'female' | 'other'; // Required
  bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'; // Required
  emergencyContact: {
    name: string;                 // Contact person full name
    relationship: string;         // E.g., "Spouse", "Parent", "Sibling"
    phoneNumber: string;          // Contact phone matching Bangladeshi format (+880...)
  };                              // Required
  allergies: string[];            // Required - E.g., ["Penicillin", "Dust"] -> Empty if none
  chronicDiseases: string[];      // Required - E.g., ["Diabetes", "Hypertension"] -> Empty if none
  weightKg?: number;              // Optional - For dynamic pediatric dosing calculations
  heightCm?: number;              // Optional
  createdAt: Timestamp;           // Required - System creation timestamp
  updatedAt: Timestamp;           // Required - System last modification timestamp
}
```

---

### Module 5: Pharmaceutical Companies Database
#### `pharma_companies` Collection
* **Description:** Authoritative directory of licensed pharmaceutical manufacturers operating in Bangladesh (verified against DGDA metrics).
* **Document ID:** `{companyId}` (Auto-generated UUIDv4 or clean slug)

```typescript
interface PharmaCompanyDocument {
  companyId: string;              // Required - Unique primary key
  nameEng: string;                // Required - English official name (e.g., "Square Pharmaceuticals PLC")
  nameBng: string;                // Required - Bangla name (e.g., "স্কয়ার ফার্মাসিউটিক্যালস")
  dgdaLicenseNum: string;         // Required - Directorate General of Drug Administration (DGDA) permit number
  isLocal: boolean;               // Required - True if domestic, False if multinational (MNC)
  status: 'active' | 'suspended'; // Required - Compliance status
  contactPhone: string;           // Required
  contactEmail?: string;          // Optional
  createdAt: Timestamp;           // Required
  updatedAt: Timestamp;           // Required
}
```

---

### Module 6: Medicine Database
#### `medicines` Collection
* **Description:** Complete index of commercially available prescription and OTC drugs in Bangladesh, directly linking generic formulations, strengths, and physical forms back to manufacturers.
* **Document ID:** `{medicineId}` (Auto-generated UUIDv4 or standard NDC slug)

```typescript
interface MedicineDocument {
  medicineId: string;             // Required - Unique medicine identifier
  brandNameEng: string;           // Required - Trade Name in English (e.g., "Napa Extend")
  brandNameBng?: string;          // Optional - Trade Name in Bangla (e.g., "নাপা এক্সটেন্ড")
  genericName: string;            // Required - Scientific formulation (e.g., "Paracetamol")
  formulation: 'tablet' | 'capsule' | 'syrup' | 'injection' | 'inhaler' | 'ointment' | 'drops'; // Required
  strength: string;               // Required - Dosage strength (e.g., "665 mg", "120 mg/5 ml")
  unitPriceBdt: number;           // Required - Price in BDT for pharmacy/order preview context
  pharmaCompanyId: string;        // Required - Reference mapping to pharma_companies/{companyId}
  pharmaCompanyName: string;      // Denormalized - Copied from active company profile to prevent joins during searches
  isPrescriptionRequired: boolean;// Required - Restricts purchase classification
  searchTokens: string[];         // Required - Title-case and lowercase tokens for prefix searches ("nap", "napa")
  createdAt: Timestamp;           // Required
  updatedAt: Timestamp;           // Required
}
```

---

### Module 7: Disease Database
#### `diseases` Collection
* **Description:** Structured dictionary mapping clinical conditions. It incorporates ICD-10 medical diagnostics classifications paired with plain localized translations for patient dashboards.
* **Document ID:** `{diseaseId}` (Uses standard ICD-10/11 alphanumeric code, e.g., "I10" for Essential Hypertension)

```typescript
interface DiseaseDocument {
  diseaseId: string;              // Required - Alphanumeric ID (Primary mapping, e.g., "E11.9")
  icdCode: string;                // Required - International Classification of Diseases code (e.g., "E11.9")
  nameEng: string;                // Required - Scientific English medical title (e.g., "Type 2 Diabetes Mellitus")
  nameBng: string;                // Required - Local Bangla clinical alias (e.g., "টাইপ ২ ডায়াবেটিস")
  category: string;               // Required - E.g., "Endocrine, nutritional and metabolic diseases"
  descriptionEng: string;         // Required - High-level scientific narrative
  descriptionBng: string;         // Required - Plain-language translation for patient records
  symptoms: string[];             // Required - Multi-search indicators (e.g., ["polyuria", "polydipsia"])
  severityLevel: 'low' | 'moderate' | 'high' | 'critical'; // Required
  createdAt: Timestamp;           // Required
  updatedAt: Timestamp;           // Required
}
```

---

### Module 8: Appointment System
#### `appointments` Collection
* **Description:** Represents dynamic booking interactions between distinct user roles, physical clinics, scheduling slots, and transactional records.
* **Document ID:** `{appointmentId}` (Auto-generated UUID)

```typescript
interface AppointmentDocument {
  appointmentId: string;          // Required - Primary reference ID
  doctorId: string;               // Required - Reference matching doctors/{doctorId}
  doctorName: string;             // Denormalized - For display in patient schedule list without queries
  specialtyMain: string;          // Denormalized - For display in patient schedule list
  patientId: string;              // Required - Reference matching patients/{patientId}
  patientName: string;            // Denormalized - Displayed on doctor appointment queue panel
  scheduledDate: string;          // Required - Canonical date string (Format: YYYY-MM-DD for fast index matches)
  timeSlot: string;               // Required - Duration string matching doctor calendar, e.g., "18:00 - 18:15"
  serialNumber: number;           // Required - Patient slot integer within the day (e.g., 1, 2, 3...)
  appointmentType: 'first_consultation' | 'follow_up' | 'report_show'; // Required
  status: 'booked' | 'completed' | 'cancelled' | 'no_show'; // Required state machine
  cancelledBy?: 'doctor' | 'patient' | 'admin';            // Conditional field
  cancellationReason?: string;                             // Conditional field
  consultationFeeBDT: number;     // Required - Rate locked at time of booking (regardless of future doctor price changes)
  paymentStatus: 'pending' | 'completed' | 'refunded';     // Required - Tracking deposit
  paymentMethod?: 'bkash' | 'nagad' | 'card' | 'cash';     // Optional
  createdAt: Timestamp;           // Required
  updatedAt: Timestamp;           // Required
}
```

---

### Module 9: E-Prescription
#### `prescriptions` Collection
* **Description:** The ultimate medical and legal record containing specific clinical evaluations, drug dosages, safety frequencies, and diagnostic instructions given to patients. Built with self-contained, audit-safe structures.
* **Document ID:** `{prescriptionId}` (Auto-generated UUIDv4 or human-readable format, e.g., `MZ-EP-YYYYMMDD-XXXXX`)

```typescript
interface PrescriptionDocument {
  prescriptionId: string;         // Required - Unique clinical ID
  appointmentId: string;          // Required - Link reference to appointments/{appointmentId}
  doctorId: string;               // Required - Foreign link to doctors/{doctorId}
  doctorDetailsDenormalized: {
    name: string;
    qualifications: string[];
    specialties: string[];
    bmdcRegNumber: string;
  };                              // Required - Guarantees PDF/Prescription remains accurate if doctor profile evolves
  patientId: string;              // Required - Foreign link to patients/{patientId}
  patientDetailsDenormalized: {
    name: string;
    ageAtPrescription: number;    // Calculated age in years at date of execution
    gender: 'male' | 'female' | 'other';
    weightKg?: number;
  };                              // Required - Preserves demographic state at the specific point-of-care
  diagnoses: Array<{
    diseaseId: string;            // Reference to diseases/{diseaseId}
    icdCode: string;              // Duplicated for convenience
    notes?: string;               // Doctor custom specific notes
  }>;                             // Required - Must have at least 1 diagnosed disease or physical symptom
  medicinesPrescribed: Array<{
    medicineId: string;           // Reference to medicines/{medicineId}
    brandName: string;            // Copied from drug listing
    genericName: string;          // Copied from drug listing
    dosage: string;               // Multi-day instruction, e.g., "1+0+1" (Morning+Noon+Night) or "1-0-0-1"
    timing: 'before_meal' | 'after_meal' | 'with_meal' | 'empty_stomach'; // Local clinical timing standards
    durationDays: number;         // E.g., 7, 30, 90
    quantityToDispense: number;   // E.g., 14 tablets
    customInstructions?: string;  // Explicit physician advisory in Bangla or English
  }>;                             // Required - Minimum 1 instruction (or OTC reference)
  dietaryRestrictions?: string[]; // Optional - Special dietary warnings (e.g., "Low Salt")
  nextFollowUpSuggestedDays?: number; // Optional - Suggested timeline for return (e.g., 14 days)
  isFinalized: boolean;           // Required - Once true, document becomes locked for edits
  digitalSignatureHash?: string;  // Optional/Phased - Cryptographic audit seal proving doctor authentication
  createdAt: Timestamp;           // Required
  updatedAt: Timestamp;           // Required
}
```

---

### Module 10: Audit Logs
#### `audit_logs` Collection
* **Description:** Read-Only platform logs for compliance and accountability. Captures create, read, update, and delete actions across MZ Health.
* **Document ID:** `{logId}` (Auto-generated UUID)

```typescript
interface AuditLogDocument {
  logId: string;                  // Required - Unique logging event ID
  actorId: string;                // Required - Reference index to users/{userId} triggering action
  actorRole: 'super_admin' | 'admin' | 'doctor' | 'patient' | 'system'; // Required
  actionType: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT'; // Required type classification
  resourceTarget: 'users' | 'doctors' | 'patients' | 'appointments' | 'prescriptions' | 'medicines'; // Target collection
  resourceDocId: string;          // ID of target document being modified
  payloadChanges?: {
    fieldsModified: string[];     // E.g., ["status", "paymentStatus"]
    previousState?: any;          // Null on creations. Strict tracking of historical snapshot or checksum
    newState?: any;               // Represents target outcome properties configuration
  };                              // Conditional - Present for critical state transformations
  ipAddress: string;              // Required - IP footprint for defensive operations
  userAgent: string;              // Required - Client software cataloging (App vs Admin Web)
  timestamp: Timestamp;           // Required - Absolute capture reference (Server-Locked)
}
```

---

## 3. Relationship Diagram

The following diagram tracks referencing and denormalization. Relationships are explicitly maintained via primary ID references (foreign keys represented via `id` strings) and denormalization maps optimized for UI rendering:

```text
  +------------------+                   +------------------+
  |      users       |                   | pharma_companies |
  +------------------+                   +------------------+
  | - uid (PK)       |                   | - companyId (PK) |
  +--------+---------+                   +--------+---------+
           | 1                                    | 1
     +-----+-----+                                | 
   1 |         1 |                                | 1:N
+----+----+ +----+----+                           |
| doctors | |patients |                           v
+---------+ +---------+                  +------------------+
|doctorId*| |patientId|                  |    medicines     |
+----+----+ +----+----+                  +------------------+
     | 1         | 1                     | - medicineId (PK)|
     |           |                       | - pharmaCompanyId|
     |           |                       +--------+---------+
     | 1:N       | 1:N                            |
     +-----+-----+                                | 
           |                                      |
           v                                      | 
  +------------------+                            |
  |   appointments   |                            |
  +--------+---------+                            |
  | - id (PK)        |<------------------------+  |
  | - doctorId (FK)  |                         |  |
  | - patientId (FK) |                         |  | 
  +--------+---------+                         |  | 
           | 1                                 |  | 
           |                                   |  | 
           v (1:1 link)                        |  | Refers to
  +------------------+                         |  | medicines
  |  prescriptions   |                         |  | inside list
  +------------------+                         |  | 
  | - id (PK)        |                         |  | 
  | - appointmentId* |                         |  | 
  | - doctorId (FK)  |                         |  | 
  | - patientId (FK) |                         |  | 
  | - medicines[]----+-------------------------+--+
  | - diagnoses[]----+-------------------------+
  +------------------+                         |
                                               v
                                         +-----------+
                                         | diseases  |
                                         +-----------+
                                         |diseaseId* |
                                         +-----------+

* (FK) => Foreign Key string pointer referencing primary keys
* Lines designate data synchronization paths & physical dependency models
```

---

## 4. Security Model

Security logic relies on top-level role authentication verified via Firebase Custom Claims (`super_admin`, `admin`, `doctor`, `patient`) mapped during account onboarding.

### Access Control Matrix

| Collection | Super Admin / Admin | Doctor | Patient | Unauthenticated / Public |
| :--- | :--- | :--- | :--- | :--- |
| `users` | **R/W** (All fields) | **R** (Self, Patient records) | **R** (Self) | **Forbidden** |
| `doctors` | **R/W** (Verification) | **R/W** (Self details) | **R** (Search, Book panels) | **R** (Search panel list only) |
| `patients` | **R/W** (Restricted Fields) | **R** (Clinical profiles) | **R/W** (Self metadata only) | **Forbidden** |
| `pharma_companies` | **R/W** (All fields) | **R** (Read list) | **R** (Read list) | **Forbidden** |
| `medicines` | **R/W** (All fields) | **R** (Listing lookup) | **R** (Catalog query) | **R** (Catalog query) |
| `diseases` | **R/W** (All fields) | **R** (Diagnostic lookup) | **R** (Standard info only)| **Forbidden** |
| `appointments` | **R/W** (Scheduling overrides) | **R/W** (Doctor specific slots)| **R/W** (Patient specific bookings)| **Forbidden** |
| `prescriptions` | **R** (Compliance check) | **R/W** (Write signature) | **R** (Self prescriptions) | **Forbidden** |
| `audit_logs` | **R** (Security reviews) | **Forbidden** | **Forbidden** | **Forbidden** |

### Core Security Principles & Rules Logic (Conceptual)
1. **Immutable Audit Trail:** Documents in the `audit_logs` collection allow **only writes (CREATE)**. Modifying (`UPDATE`) or purging (`DELETE`) log documents is strictly blocked for all user roles, including Admins.
2. **Prescription Integrity:** Prescriptions are conditionally writeable. A doctor can change fields while `isFinalized` is equal to `false`. Once the field `isFinalized` becomes `true`, all further modifications (`UPDATE` or `DELETE`) are strictly forbidden. Patients can only query their own prescriptions (`request.auth.uid == resource.data.patientId`).
3. **Medical Record Confidentiality:** Safe-room policy rules check if the current doctor has an active, scheduled, or past appointment with the patient (`appointments` collection join query, or verified relationship lookup) before granting read privileges on a patient's historical medical records (`patients` files & previous `prescriptions`).
4. **Verified Doctors Only:** Write properties within the `doctors` database (such as setting `bmdcVerified: true`) can only be modified by accounts authenticated with the `super_admin` or `admin` role. No doctor user can bypass verification.
5. **No Public Identification Scanning:** Unauthenticated users can access basic search parameters (`doctors` and `medicines`) to facilitate public discovery, but are blocked from indexing, paginating, or querying demographic details (phone numbers, addresses) of registered patients.

---

## 5. MVP Database Architecture & Indexing Plans

### Single-Field Indices
By default, Firestore creates individual indices for each scalar field within a document. However, fields storing system metadata, nested arrays, or large descriptive text can be safely excluded to optimize write performance and reduce storage footprint:
* **Exempt from single-field auto-indices:**
  * `doctors.chambers` (complex maps)
  * `prescriptions.dietaryRestrictions` (array query not required)
  * `patients.allergies` & `patients.chronicDiseases`
  * Description fields in Bangla/English for `diseases` and `medicines`

### Required Composite Indices

To support complex queries in the MZ Health MVP dashboard, the following composite indices must be provisioned:

#### 1. Doctors Lookup & Sorting
* **Objective:** Find active, verified physicians within a specific specialty, sorted by clinical experience.
* **JSON Target Structure:**
  ```json
  {
    "collectionGroup": "doctors",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "bmdcVerified", "order": "ASCENDING" },
      { "fieldPath": "specialties", "arrayConfig": "CONTAINS" },
      { "fieldPath": "experienceYears", "order": "DESCENDING" }
    ]
  }
  ```

#### 2. Patient Appointment Dashboard
* **Objective:** List non-cancelled appointments for a specific patient sorted by latest scheduled date for chronic monitoring.
* **JSON Target Structure:**
  ```json
  {
    "collectionGroup": "appointments",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "patientId", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "scheduledDate", "order": "DESCENDING" }
    ]
  }
  ```

#### 3. Doctor Daily Queue
* **Objective:** Efficient list of active bookings for a doctor on a specific day sorted by serial number.
* **JSON Target Structure:**
  ```json
  {
    "collectionGroup": "appointments",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "doctorId", "order": "ASCENDING" },
      { "fieldPath": "scheduledDate", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "serialNumber", "order": "ASCENDING" }
    ]
  }
  ```

#### 4. Audit Security Review
* **Objective:** Filter log actions by resource type (e.g., `prescriptions`) sorted by timestamp to detect anomalies.
* **JSON Target Structure:**
  ```json
  {
    "collectionGroup": "audit_logs",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "resourceTarget", "order": "ASCENDING" },
      { "fieldPath": "timestamp", "order": "DESCENDING" }
    ]
  }
  ```

---

## 6. Future Scalability Configurations

Firestore possesses unique operational rules and boundaries. The MZ Health database architecture is configured with proactive strategies to guarantee flawless scale beyond Bangladesh's growth curves:

### Overcoming the "1 Write per Second" Limit
* **The Problem:** Firestore constraints limit write actions to a single target document at a rate of 1 write per second. If thousands of appointments or profile views happen on a peak morning, incrementing counters (such as `doctors.totalAppointmentsCount`) will source systemic locks.
* **The Solution:** 
  * Avoid updating counters instantly inside the doctor's document during transactions.
  * Implement **Distributed Counters** (sharding counter documents in a subcollection and aggregating) or use external pipeline consolidation (Cloud Functions trigger executing scheduled Cloud tasks to run batch-aggregates every 10 minutes).

### Secure Query Pagination
* **Performance Control:** Loading large patient listings or medicine catalogs directly without constraints degrades system latency and rapidly consumes Firestore usage budgets.
* **The Solution:** 
  * Limit all query returns to standard paging limits (`limit(30)`).
  * Use **Query Cursors** (`startAfter(lastDocumentVisible)`) rather than integer offsets. Offsets still read and charge for every skipped document. Cursors execute instantly.

### Hot Spot Prevention (Alphanumeric Sequential ID Mitigation)
* **The Problem:** Writing documents with monotonically increasing keys (such as alphabetical strings or incremental timestamps) inside high-frequency collections creates "hotspots" in the database partitions, degrading performance globally.
* **The Solution:** 
  * All transactional entities (appointments, prescriptions, users) use completely random UUIDv4 identifiers or secure Firestore auto-generated alphanumeric keys containing high entropy. 
  * `audit_logs` documents use a prefix structure paired with random identifiers.

### Dynamic Generic-to-Brand Search Optimization
* **Performance Control:** Patients searching the database for "Napa" or "Paracetamol" shouldn't require complex SQL regex statements (unsupported in NoSQL flat databases).
* **The Solution:** 
  * The `searchTokens` array field inside the `medicines` collection operates as a prefix directory created via Cloud Triggers when a pharmaceutical product is registered or updated. This supports instant, lightning-fast compound prefix queries (`where('searchTokens', 'array-contains', 'nap')`) without requiring external search engine clusters in Version 1.

---
**Approved & Signed By:**
*Senior Firebase Healthcare Architect, MZ Systems*
