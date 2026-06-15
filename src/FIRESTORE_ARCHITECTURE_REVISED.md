# MZ Health - Revised Production-Ready Firestore Architecture Specification
## Document Metadata
* **Project Name:** MZ Health (Healthcare Super App for Bangladesh)
* **Parent Entity:** MZ Systems (Bangladesh)
* **Author:** Principal Firestore Architect & Clinical Systems Engineer
* **Date:** June 13, 2026
* **Target Environment:** Google Cloud Firestore (Native Mode)
* **Status:** Revised & Approved Post-Audit

---

## 1. Executive Summary of Revisions

This revised specification updates the database architecture of MZ Health to address critical high-concurrency and security issues identified during the external architect audit:
1. **Dynamic Schedule Master & Slot Locking:** Standardized on a dedicated `/appointment_slots` collection to manage precise clinician availability, locking, blockages, and cancellations dynamically.
2. **Double-Booking Prevention Block (Transactions):** Documented a multi-doc Firestore Transaction flow ensuring absolute consistency.
3. **Write Contention (1 Write/Sec) Prevention:** Separated dynamic statistical metrics (ratings, total queries) from primary clinical documents using sharded metadata collectors.
4. **Enhanced Onboarding Validation Rules:** Outlined explicit security rule boundaries blocking authorization escalations during self-onboarding.
5. **Electronic Prescription Legitimacy & Digital Signatures:** Implemented cryptographic hash capturing to support non-repudiation in healthcare records.

---

## 2. Revised Collection Hierarchy

```text
/ (Database Root)
├── users (Collection)
├── doctors (Collection)
├── patients (Collection)
├── appointment_slots (Collection)     <-- NEW: Dedicated atomic slots collection
├── appointments (Collection)
├── prescriptions (Collection)
├── pharma_companies (Collection)
├── medicines (Collection)
├── medicine_catalogs (Collection)     <-- NEW: Lightweight search target cache index
├── diseases (Collection)
├── notifications (Collection)
├── settings (Collection)
├── emergency_overrides (Collection)   <-- NEW: Restrictive Break-The-Glass tracking
└── audit_logs (Collection)
```

---

## 3. Atomic Slot Locking & Double-Booking Prevention

### 1. Document Structure: appointment_slots Collection
* **Path:** `/appointment_slots/{slotId}`
* **Document ID Pattern:** `slot_{doctorId}_{date}_{timeRange}` (e.g., `slot_doc123_20260615_1700_1715`)
* **Rationale:** A deterministic document ID enables instant checkouts, scheduling offsets, and transactional queries without reading entire subcollections.

```typescript
interface AppointmentSlotDocument {
  slotId: string;                        // Deterministic primary key
  doctorId: string;                     // Foreign reference matching doctors/{userId}
  chamberId: string;                    // Target clinical chamber ID
  scheduledDate: string;                // Date pattern: "YYYY-MM-DD"
  startTime: string;                    // Time string, "17:00"
  endTime: string;                      // Time string, "17:15"
  timeString: string;                   // Complete period representation (e.g., "05:00 PM - 05:15 PM")
  status: 'available' | 'locked' | 'booked' | 'blocked'; // Core state machine
  lockedByUserId?: string;              // Temporary lock session ID (prevents shopping cart collisions)
  lockExpiresAt?: Timestamp;            // Expiration timestamp for temporary holds (automatically clears after 5 minutes)
  associatedAppointmentId?: string;     // Reference matching appointments/{id} if booked
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### 2. Double-Booking Prevention Transaction Strategy

To prevent concurrency issues during dynamic booking spikes (e.g., when 50 patients attempt to reserve a popular doctor’s single calendar slot), the client / backup engine must execute a state transaction:

```text
    CLIENT TRANSACTION PATH
  +---------------------------+
  | Ingests user request to   |
  | book target slotId        |
  +-------------+-------------+
                |
                v (Initiates Firestore Transaction)
  +-----------------------------------------------------------+
  | STEP 1: READ /appointment_slots/{slotId}                  |
  | - Asserts document exists                                 |
  | - Asserts status is equal to 'available'                  |
  | - Asserts (status == 'locked' && lockExpiresAt < now) is  |
  |   true (if currently held but expired)                     |
  +-----------------------------+-----------------------------+
                                |
                  +-------------+-------------+
                  |                           |
                  | (Asserts Pass)            | (Asserts Fail)
                  v                           v
  +-------------------------------+  +-------------------------------+
  | STEP 2: WRITE Session Hold     |  | ABORT Transaction             |
  | - Set status = 'locked'       |  | - Yield error: "Slot held by  |
  | - Set lockedByUserId = patient |  |   another user or booked"     |
  | - Set lockExpiresAt = now+5m  |  +-------------------------------+
  +---------------+---------------+
                  |
                  v (Generates Booking Payload)
  +-----------------------------------------------------------+
  | STEP 3: WRITE appointments/apt_xxx                         |
  | - Configures complete booking fields                      |
  | - Generates queue serial numbers                          |
  +-----------------------------+-----------------------------+
                                |
                  +-------------+-------------+
                  v                           v
  +-------------------------------+  +-------------------------------+
  | STEP 4: WRITE Slot Finalize   |  | STEP 5: WRITE transaction     |
  | - Set status = 'booked'       |  |   metadata to audit logs      |
  | - Set associatedAppointmentId |  +-------------------------------+
  |   = apt_xxx                   |
  +-------------------------------+
```

---

## 4. Sharded Analytics & Contention Performance Control

### 1. The Doctor Metadata Shards
To satisfy the "1 Write per second" limit on active documents, aggregates and metadata are completely decoupled from `/doctors/{doctorId}`. This prevents rate locks when hundreds of reviews occur simultaneously on peak clinics.

#### Path: `/doctors/{doctorId}/counters_shards/{shardId}`
* **Document ID:** `{shardId}` (Determined randomly, integer `0` through `9`)

```typescript
interface DoctorCounterShardDocument {
  shardId: string;                      // Integer string: "0" - "9"
  totalAppointmentsCount: number;       // Increment/decrement tracking bucket
  ratingSum: number;                    // Total accumulated stars (for running average)
  ratingCount: number;                  // Number of ratings recorded in this bucket
}
```

#### Reconstitution Query (Aggregating in Background / Reads)
```typescript
// Calculation of running clinical averages:
async function getAggregatedDoctorStats(doctorId: string) {
  const shards = await firestore.collection(`doctors/${doctorId}/counters_shards`).get();
  let appointmentsTotal = 0;
  let ratingSumTotal = 0;
  let ratingCountTotal = 0;

  shards.forEach(doc => {
    const data = doc.data();
    appointmentsTotal += data.totalAppointmentsCount;
    ratingSumTotal += data.ratingSum;
    ratingCountTotal += data.ratingCount;
  });

  return {
    totalAppointments: appointmentsTotal,
    averageRating: ratingCountTotal > 0 ? (ratingSumTotal / ratingCountTotal) : 0
  };
}
```

---

## 5. Security Rules & Onboarding Mitigation Checks

To prevent patients from escalating privileges during the self-signup path or doctors from marking themselves as administrator-verified without physical vetting:

```typescript
// Production Native Security Rules Snippet
match /users/{userId} {
  allow create: if isAuthenticated() 
                && isOwner(userId) 
                && request.resource.data.role == 'patient' 
                && request.resource.data.isActive == true;
  
  allow update: if isOwner(userId) 
                && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'isActive']);
}

match /doctors/{doctorId} {
  allow create: if isAuthenticated() 
                && isOwner(doctorId) 
                && getUserClaims().role == 'doctor';
                
  allow update: if isOwner(doctorId) 
                && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['bmdcVerified', 'totalAppointmentsCount']);
}
```

---

## 6. Safe Electronic Prescriptions with Cryptographic Signatures

To guarantee full medico-legal compliance under Bangladesh Healthcare Guidelines, validated E-Prescriptions store secure signature footprints verifying physician validation:

```typescript
interface PrescriptionIntelligenceDocument {
  prescriptionId: string;               // Unique ID
  appointmentId: string;                // Linked booking reference
  doctorId: string;
  patientId: string;
  
  // --- Secure Legal Compliance Node ---
  legalCertification: {
    isFinalized: boolean;               // Locked parameter: once set to true, no edits are allowed
    bmdcRegNumber: string;              // Verified license state
    digitalSignatureHash: string;       // SHA-256 Hash of: {doctorId} + {patientId} + {timestamp} + {finalizedDiagnosesChecksum}
    signatureTimestamp: Timestamp;      // Time verification was executed
  };
  
  // ... Clinical Diagnoses, Symptoms, and Prescribed Medicines items follow
}
```

---

## 7. Bilingual Search Optmization Catalogues

To speed up lookups for over 100,000+ medicines on mobile devices without exhausting users' mobile plan data, search structures are split into separate collections to segregate massive datasets:

### 1. Shallow Search Target Catalogue: `/medicine_catalogs`
* **Path:** `/medicine_catalogs/{medicineId}`
* **Description:** Contains minimal attributes for rapid auto-complete search displays.

```typescript
interface MedicineSearchCatalog {
  medicineId: string;                   // Derived matching product master ID
  brandNameEng: string;                 // e.g., "Napa Extend"
  brandNameBng: string;                 // e.g., "নাপা এক্সটেন্ড"
  genericName: string;                  // e.g., "Paracetamol"
  strength: string;                     // e.g., "665 mg"
  dosageForm: string;                   // e.g., "Tablet"
  manufacturerNameEng: string;          // e.g., "Square Pharmaceuticals PLC"
  searchTokens: string[];               // Custom progressive prefix arrays for English (e.g., "nap", "napa")
  bengaliSearchTokens: string[];        // Progressive prefix arrays for Bengali (e.g., "নাপ", "নাপা")
  isActive: boolean;
}
```
* **Scalability Outcome:** Mobile client devices can synchronize and cache these lightweight (~100 bytes) search records dynamically. This enables offline lookup capabilities across high volumes of domestic brands while storing rich medical details securely in the primary `/medicines` database to be accessed solely on demand.

---
**Approved & Signed By:**
*Principal Firestore Architect, MZ Systems*
