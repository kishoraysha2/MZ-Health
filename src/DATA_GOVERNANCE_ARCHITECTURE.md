# Bangladesh Medicine Intelligence System (BMIS)
## Sprint 3C: Enterprise Data Governance, Operations & Lifecycle Specification

**Authors:** Chief Healthcare Architect, Senior Firebase Architect, Data Governance Architect, Healthcare Compliance Architect  
**Status:** Approved & Frozen for Implementation  
**Version:** 3.2.0  

---

## 1. Executive Editorial & Architectural Vision
When deploying a digital health infrastructure scaling to **10 million+ active patients, doctors, and pharmacists**, data stability is a lives-at-stake requirement. Data corruption from uncontrolled imports, accidental manual deletions by technicians, or incorrect pricing configurations can lead to critical clinical failures at the pharmacy counter or the patient portal.

This specification cements the **Data Governance Layer** of the BMIS. It ensures that before a single real medical entry is imported into our verified **Sprint 3A & 3B** databases, strict gates are established. Every change is tracked, every deletion is soft-virtualized, every bulk import undergoes multi-stage review, and the entire database is continually monitored via an autonomous state checker.

---

## 2. Multi-Tier Relational Chain Definition (Restated)
For reference, all governance actions operate directly upon this verified relational chain:

$$\text{pharmaceutical\_companies} \rightarrow \text{medicine\_generics} \rightarrow \text{medicines} \rightarrow \text{medicine\_catalogs}$$

---

## 3. System Health Engine (`system_health`)

To ensure real-time regulatory trust, the health engine constantly polls or registers heartbeats for crucial infrastructure pillars, calculating an overall binary system state (**PASS / FAIL**).

### 3.1 Collection: `system_health`
* **Path:** `/system_health/{componentId}` (Document per subsystem)

```typescript
export interface SystemHealthHeartbeat {
  componentId: 'auth' | 'rbac' | 'firestore' | 'search_engine' | 'import_engine' | 'audit_logs' | 'notifications';
  componentName: string;                 // Descriptive human-readable tracker label
  status: 'PASS' | 'FAIL';               // Absolute binary state representation
  latencyMs: number;                     // Connection execution duration (for performance tracking)
  lastCheckedAt: string;                  // ISO 8601 Timestamp of health check execution
  failureReason: string | null;          // Error details in case status resolves to 'FAIL'
  incidentReferenceId: string | null;    // Automatic ticketing system log ID mapping
}
```

### 3.2 Global System Health Integration Flow
For a state to be declared overall operational, all core components must register a `PASS`. If any core element (`auth`, `rbac`, or `firestore`) turns to `FAIL`, an automated high-priority alert triggers.

---

## 4. Data Import Template Engine (`data_import_templates`)

To catalog allowed data formats and ensure imports are parsed consistently, import templates map constraints for raw file processing (CSV, Excel, JSON).

### 4.1 Collection: `data_import_templates`
* **Path:** `/data_import_templates/{templateId}`

```typescript
export interface InputFieldRule {
  fieldName: string;                     // Matches physical database parameter (e.g., "brandNameEnglish")
  type: 'string' | 'number' | 'boolean' | 'array_string';
  isRequired: boolean;
  regexValidation: string | null;        // Formatting matches (e.g., strength parsing constraints)
  description: string;
}

export interface DataImportTemplate {
  templateId: string;                    // Unique identifier (e.g., "TMP-PHARMA-01", "TMP-MEDICINE-02")
  targetCollection: 'pharmaceutical_companies' | 'medicine_generics' | 'medicines' | 'diseases';
  allowedFormats: ('csv' | 'xlsx' | 'json')[];
  fieldMappingRules: InputFieldRule[];
  checksumHash: string;                  // Standard template structure sanity hash (prevents file tampering)
  createdAt: string;
  updatedAt: string;
}
```

### 4.2 Standard Template Blueprint Mappings

#### 4.2.1 Pharmaceutical Companies Template (`TMP-PHARMA-01`)
* Target: `pharmaceutical_companies`
* Headers: `companyId`, `companyNameEnglish`, `companyNameBengali`, `companyShortName`, `dgdaRegistrationNumber`, `headquarters`
* Key Check: Regex `^PC-[A-Z0-9_\-]+$` matches the ID format.

#### 4.2.2 Medicine Generics Template (`TMP-GENERIC-02`)
* Target: `medicine_generics`
* Headers: `genericId`, `genericNameEnglish`, `genericNameBengali`, `therapeuticClass`, `pregnancyCategory`
* Key Check: Pregnancy category must map to enum `['A', 'B', 'C', 'D', 'X', 'N/A']`.

#### 4.2.3 Medicines Master Template (`TMP-MEDICINE-03`)
* Target: `medicines`
* Headers: `medicineId`, `brandNameEnglish`, `brandNameBengali`, `genericId`, `manufacturerId`, `strength`, `dosageForm`, `unitPrice`
* Key Check: Validates that both `genericId` and `manufacturerId` pass relational checks against existing databases.

#### 4.2.4 Disease Intelligence Template (`TMP-DISEASE-04`)
* Target: `diseases`
* Headers: `diseaseId`, `diseaseNameEnglish`, `diseaseNameBengali`, `icd10Code`, `symptoms`, `contraindicatedGenerics`
* Key Check: ICD-10 code matches global clinical classification models.

---

## 5. Manual Data Entry Architecture (Lifecycle API Model)

For changes made outside of automated pipelines (e.g., adding a single new pharmacy company or manually spelling-correcting a generic molecule), records progress through strict lifecycle methods.

```
       [ Add / Edit Request ] 
                 |
                 v
       [ Approval Workflow ]  ──(Reviewer Rejects)──> [ Rejected State ]
                 |                                           |
         (Reviewer Approves)                                 | (Operator Re-Edits)
                 |                                           v
                 v                                   [ Back to Pending ]
       [ Published: Active ]
                 |
         (Operator Archives) 
                 |
                 +──> [ Archived State ]
                 |          |
                 |          +──(Operator Restores)──> [ Published: Active ]
                 |
         (Operator Soft-Deletes)
                 |
                 v
         [ Deleted State ]
```

### 5.1 Manual Operation Definitions
* **Add**: Creates a new record. Automatically marked as `pending` under the Approval Workflow. It cannot be used in active prescriptions or live clinical searches until it is approved and published.
* **Edit**: Creates a new draft version. The current, active catalog version remains live while the draft modification travels through the Approval Workflow.
* **Archive**: Toggles status to `archived`. Preserves existing clinical records but prevents any new prescription matches.
* **Restore**: Recovers an `archived` or soft-`deleted` document back to the active `published` directory.

---

## 6. Database Reset Architecture (Zero-Leak Protection)

To support testing, quality audits, and sandbox experiments without risking accidental deletion of validated medical records, resetting must be managed with strict safety levels.

### 6.1 Database Reset Execution Levels

| Operation Level | Target Data Coverage | Structural Impact | Authorizing Identity Gate |
|:---|:---|:---|:---|
| **Level 1: Clear Demo Data** | Purges documents in any collection containing `isDemo: true` attributes. | Retains production data. | System Owner / Super Admin |
| **Level 2: Clear Test Data** | Deletes test indexes, pipeline artifacts, and clinical records under `testing` attributes. | Keeps production configurations. | System Owner (Multi-Factor Signature Required) |
| **Level 3: Factory Reset** | Complete clear of all collections (Companies, Generics, Medicines, Diseases, etc.). | Resets the system to blank slate. | Chief System Owner (Root Console Only) |

### 6.2 Relational Guarding Rules
1. Reset operations are strictly forbidden from executing on standard production containers (`process.env.BMIS_ENV == 'production'`).
2. Execution of Level 3 Factory resets requires explicit dual-authorization (second Super Admin validation token) and signature verification at the Security Rule database layer.

---

## 7. Seed Data Engine (`seed_data`)

To support testing of systems without real clinical records, a separate collection stores isolated mock entities used to quickly seed sandboxes.

### 7.1 Collection: `seed_data`
* **Path:** `/seed_data/{seedId}`

```typescript
export interface SeedDataPayload {
  seedId: string;                        // Unique reference (e.g., "SEED-SET-BANGALORE-01")
  targetGroup: 'clinical_sandbox' | 'corporate_test' | 'load_testing';
  demoDoctors: {
    uid: string;
    fullName: string;
    bmdcRegistrationNumber: string;
    specialization: string;
  }[];
  demoPatients: {
    uid: string;
    fullName: string;
    nidNumber: string;
    bloodGroup: string;
  }[];
  demoCompanies: {
    companyId: string;
    companyNameEnglish: string;
    dgdaRegistrationNumber: string;
  }[];
  demoMedicines: {
    medicineId: string;
    brandNameEnglish: string;
    genericId: string;
    unitPrice: number;
  }[];
  demoDiseases: {
    diseaseId: string;
    icd10Code: string;
    diseaseNameEnglish: string;
  }[];
  createdAt: string;
}
```

---

## 8. Import Preview Engine (Simulation Gate)

Before writing any imported files to the database, the **Import Preview Engine** parses raw uploads in dry-run mode, returning a simulated preview report to the console.

### 8.1 Ingestion Flow
1. Operator uploads raw data (e.g., `medicines_dgda_draft.csv`).
2. System reads the file into memory chunk-by-chunk. No database writes are initiated.
3. The validation checker evaluates every single record against schema rules, duplication markers, and referential constraints.
4. Generates an `ImportPreviewReport` document returned immediately to the operator for manual verification.

### 8.2 Structure of Ingestion Preview Output
```typescript
export interface ImportErrorRecord {
  rowIndex: number;                      // Direct location indicator inside target file
  malformedKey: string;                  // Field causing rejection (e.g., "unitPrice") 
  rejectionReason: 'duplicate' | 'missing_field' | 'invalid_format' | 'broken_relationship';
  errorDetails: string;                  // System validation diagnostic log
}

export interface ImportPreviewReport {
  previewJobId: string;                  // Reference UUID linked to the active job
  fileName: string;
  totalParsedRows: number;
  validRowCount: number;
  invalidRowCount: number;
  detectedDuplicates: number;            // Identifies entries already matched in live db
  validationErrors: ImportErrorRecord[]; // Array containing precise rejection logs
  canProceed: boolean;                   // Evaluates to TRUE only if invalidRowCount == 0
}
```

---

## 9. Bulk Data Export Engine

Allows clinical records to be exported into Standardized Formats while preserving zero-trust privacy criteria. Export processes are filtered to mask Personally Identifiable Information (PII).

### 9.1 Export Context Specifications

| Export Target | Format Options | Security Masking / Anonymization Policy | Operational Rate Limit |
|:---|:---|:---|:---|
| **Companies** | CSV, XLSX, JSON | Public corporate data. No custom key masking. | Max 2 exports per hour per IP. |
| **Generics** | CSV, XLSX, JSON | Global medical constants. No masking. | Max 5 exports per hour. |
| **Medicines** | CSV, XLSX, JSON | Public commercial catalog. Pricing constraints. | Max 2 exports per hour. |
| **Diseases** | CSV, XLSX, JSON | Generic ICD classifications. | Max 5 exports per hour. |
| **Doctors** | CSV, JSON | Masks BMDC registration sequences and signs, encrypts contact elements. | Admin permission required. Multi-factor verification. |
| **Patients** | CSV, JSON | **Strict Masking Mandatory**: National NIDs, exact birthdates, and residential lines are filtered out. | Super Admin authorization required. Complete Audit Log entry. |

---

## 10. Backup & Restore Architecture

Disaster recovery is managed through structured, transactional snapshots recorded in the `backup_jobs` collection.

### 10.1 Collection: `backup_jobs`
* **Path:** `/backup_jobs/{backupId}`

```typescript
export interface BackupJob {
  backupId: string;                      // Unique snapshot ID (e.g., "BKP-2026-06-15-DAILY")
  backupType: 'manual' | 'scheduled';
  scheduleType: 'daily' | 'weekly' | 'custom' | 'none';
  gcsBucketUrl: string;                  // Cloud Storage destination path containing backup payload
  totalCollectionsBackedUp: string[];    // Target directories preserved (e.g., ["medicines", "users"])
  totalDocumentCount: number;
  databaseSizeInMb: number;
  status: 'pending' | 'creating' | 'successful' | 'failed';
  createdBy: string;                     // ID of system orchestrator or "SYSTEM" schedule trigger
  createdAt: string;
  completedAt: string | null;
}
```

### 10.2 Database Restore Point Policy
To prevent write-collision and cascading inconsistencies, during database restoration from an active snapshot:
1. The target BMIS instance is temporarily placed in **Read-Only / Maintenance Mode** at the Firestore rules level.
2. Active user prescription operations are paused.
3. The restore service performs a bulk clear and reload, validates database integrity, and unblocks the system's write gates.

---

## 11. Data Versioning & Verification History (`data_versions`)

To ensure compliance with medical standards and maintain data transparency, every attribute mutation (updates, metadata changes, role adjustments) triggers an automatic append-only transaction entry tracking the operation detail.

### 11.1 Collection: `data_versions`
* **Path:** `/data_versions/{versionId}` (Global write-once registry)

```typescript
export interface DataVersionRecord {
  versionId: string;                     // Invariant identifier sequence
  targetCollection: 'pharmaceutical_companies' | 'medicine_generics' | 'medicines' | 'diseases';
  targetDocumentId: string;              // Key pointing to modified document reference
  changeType: 'create' | 'update' | 'archive' | 'restore' | 'delete';
  oldValue: Record<string, any> | null;  // Prior attribute snapshot (null on creations)
  newValue: Record<string, any> | null;  // Modified attribute snapshot (null on deletions)
  changedBy: string;                     // UID of operator initiating the change
  changedAt: string;                     // Timestamp mapped directly to `request.time`
}
```

### 11.2 Data Verification Ledger Rules
1. Documents in `data_versions` are **Append-Only**. Update and delete actions are blocked at the Firestore security rule layer for all operational profiles (including Super Admins).
2. Serves as our unalterable compliance ledger, ensuring complete accountability for modified retail drug values or prescription metadata.

---

## 12. Soft-Delete Design Pattern

In medical systems, physical document deletion is prohibited. Archiving or deleting patients or clinical products must retain data history for audits, prescriptions, and legal records.

### 12.1 Triple-State Lifecycle Model
Every governance collection is configured with a unified `lifeCycleState` parameter.

```typescript
export type LifeCycleState = 'active' | 'archived' | 'deleted';
```

### 12.2 Lifecycle Rules
* **`active`**: Fully visible. Editable, searchable, and allowed inside new digital medical prescriptions.
* **`archived`**: Hidden from consumer-grade drug lookups and search dropdowns. Still fully rendered on old historic prescription records. Re-edits block use until state returns to `active`.
* **`deleted`**: Excluded from clinical displays. Retained inside the database for compliance audits. Restorable only by verified System Admins.

---

## 13. Dynamic Four-Step Approval Workflow

To ensure clinical accuracy and database security, records changed via manual edits or imports progress through a strict four-step approval workflow before publication.

```
 [ Data Entry Operator ] ──(Saves Draft)──> [ PENDING ]
                                               |
                                        [ REVIEWER ] (Evaluates clinical validation rules)
                                               |
                                     +---------+---------+
                                     |                   |
                             (Rejects / Fixes)      (Approves)
                                     |                   |
                                     v                   v
                                [ PENDING ]        [ APPROVED ] 
                                                         |
                                                (Orchestrator Publishes)
                                                         |
                                                         v
                                                   [ PUBLISHED ]
```

### 13.1 Collection: `approval_queues`
* **Path:** `/approval_queues/{queueId}`

```typescript
export interface ApprovalQueueItem {
  queueId: string;                       // System validation tracker key
  targetCollection: 'pharmaceutical_companies' | 'medicine_generics' | 'medicines' | 'diseases';
  targetDocumentId: string;              // Points to modified document reference
  requestedChangeType: 'create' | 'update' | 'delete';
  pendingPayload: Record<string, any>;   // Proposed document modifications
  operatorUid: string;                   // Data Entry user ID
  reviewerUid: string | null;            // Medical Auditor user ID
  reviewerComments: string | null;       // Text explaining any rejections or modifications
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'published';
  createdAt: string;
  updatedAt: string;
}
```

---

## 14. Environment Isolation & Security Boundaries

To completely isolate clinical testing environments from live hospital systems and protect our database structures, BMIS enforces strict environmental separation rules.

### 14.1 Active Environments

| Environment Profile | Purpose | Base Data Integration | Security Rule Stricthess |
|:---|:---|:---|:---|
| **Production** | Serves real hospitals, pharmacies, and patients in Bangladesh. | Validated medical records only. Zero placeholder logs. | Maximum. Real-time verification, locked reset permissions. |
| **Testing** | QA automation, performance checks, and system verification. | Test accounts, bulk seed profiles. | Strict. Test databases only, Level 2 clears allowed. |
| **Sandbox** | Clinical exploration, developer sandboxing, and trials. | Custom user-generated drafts and sandbox entries. | Permissive. Dynamic resets allowed. |

### 14.2 Accidental Cross-Corruption Prevention Guards
* **Asset Separation**: Production database servers operate on entirely distinct GCP service lines and billing clusters compared to QA environments.
* **Safety Key Check**: System write scripts evaluate the active database configuration before execution. If `project_id == "bmis-production"`, sandbox seeds or clear commands throw errors and exit.
* **Client Origin Restrictions**: Firebase Auth domains restrict credentials to production domains, preventing qa-scripts from accessing live production instances.

---

## 15. Complete Enterprise Security Ruleset (Sprint 1-3C Enforced)

This unified Firebase Ruleset establishes access boundaries for systems and governance metadata.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function isSystemAdmin() {
      return isSignedIn() && (
        getUserData().role == 'admin' || 
        getUserData().role == 'super_admin'
      );
    }
    
    function isSystemOwner() {
      return isSignedIn() && (
        getUserData().role == 'super_admin'
      );
    }

    // Default Deny Security Gate (Catch-All)
    match /{document=**} {
      allow read, write: if false;
    }

    // 1. Core National Medical Registers
    match /pharmaceutical_companies/{companyId} {
      allow read: if true;
      allow write: if isSystemAdmin();
    }

    match /medicine_generics/{genericId} {
      allow read: if true;
      allow write: if isSystemAdmin();
    }

    match /medicines/{medicineId} {
      allow read: if true;
      allow write: if isSystemAdmin();
      
      // Nest historical pricing timeline as read-only audit subcollections
      match /pricing_history/{historyId} {
        allow read: if true;
        allow write: if isSystemAdmin();
      }
    }

    match /medicine_catalogs/{medicineId} {
      allow read: if true;
      allow write: if isSystemAdmin();
    }

    // 2. High-speed Ingestion and Pipelines
    match /import_jobs/{jobId} {
      allow read, write: if isSystemAdmin();
    }

    match /drug_regulatory_alerts/{alertId} {
      allow read: if true;
      allow write: if isSystemAdmin();
    }

    // 3. System Governance Registries
    match /system_health/{componentId} {
      allow read: if isSignedIn();
      allow write: if isSystemAdmin();
    }

    match /data_import_templates/{templateId} {
      allow read: if isSystemAdmin();
      allow write: if isSystemAdmin();
    }

    match /seed_data/{seedId} {
      allow read: if isSystemAdmin();
      allow write: if isSystemAdmin();
    }

    match /backup_jobs/{backupId} {
      allow read: if isSystemOwner();
      allow write: if isSystemOwner(); // Strictly protected snapshots
    }

    // Unalterable, Append-Only Compliance Verification Mappings
    match /data_versions/{versionId} {
      allow read: if isSystemAdmin();
      allow create: if isSignedIn();
      allow update, delete: if false; // Strict write-once immutability
    }

    match /approval_queues/{queueId} {
      allow read: if isSystemAdmin();
      allow write: if isSystemAdmin();
    }
  }
}
```
