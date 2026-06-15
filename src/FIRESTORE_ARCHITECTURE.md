# MZ Health - Production-Ready Firestore Database Architecture Specification
## Document Metadata
* **Project Name:** MZ Health
* **Entity:** MZ Systems (Bangladesh)
* **Author:** Principal Firestore Architect
* **Date:** June 13, 2026
* **Target Environment:** Google Cloud Firestore (Native Mode)
* **Scale Target:** 1,000,000+ Users | 100,000+ Medicines | 50,000+ Doctors | High-Concurrency Appointments

---

## 1. Naming & Structural Conventions

To prevent operational confusion during multi-team development, we enforce strict, immutable naming conventions across all environments:

### Casing
* **Collections and Subcollections:** Standard snake_case, plural (e.g., `pharma_companies`, `audit_logs`).
* **Document Attributes:** Lower camelCase (e.g., `bmdcRegNumber`, `isFirstConsultation`).
* **Constants & Enum Values:** Standard snake_case, lowercase string representations (e.g., `status: 'completed'`).

### Document ID Mapping Strategy
To achieve linear scaling, minimize lookup times, and mitigate hot spots, document keys are mapped deterministically rather than relying solely on auto-generated hashes:

| Collection Name | Document ID Pattern | Generation Source | Architectural Rationale |
| :--- | :--- | :--- | :--- |
| `users` | `{userId}` | Firebase Auth UID | 1:1 user identity mapping. Instant context lookups. |
| `doctors` | `{userId}` | Corresponds to verified user UID | Guarantees exact 1:1 relationship with parent auth record. |
| `patients` | `{userId}` | Corresponds to verified user UID | Guarantees exact 1:1 relationship with parent auth record. |
| `pharma_companies` | `pharma_{id}` | Auto-generated UUIDv4 | Unique prefix preventing ID space contamination. |
| `medicines` | `{manufacturer_key}-{brand_slug}-{strength_slug}` | Derived deterministic slug | Extreme query caching optimization. Prevent duplicate drug listings. |
| `diseases` | `icd11-{code}` or `icd10-{code}` | WHO clinical standard code | Unique global keys for standardized clinical diagnostics. |
| `appointments` | `apt_{random_uuid}` | Alphanumeric High-Entropy key | Prevents hot-spot blocks under highly concurrent morning queues. |
| `prescriptions` | `rx_{random_uuid}` | Alphanumeric High-Entropy key | Cryptographically random key providing privacy obfuscation. |
| `notifications` | `ntf_{random_uuid}` | Alphanumeric High-Entropy key | Scalable individual trace keys for event delivery tracking. |
| `settings` | `{userId}` or `sys_{config_key}` | Corresponds to user UID or hardcoded string | Fast configuration parsing both locally and system-wide. |
| `audit_logs` | `log_{random_uuid}` | Alphanumeric High-Entropy key | Single append-only key path avoiding logical write collusions. |

---

## 2. Final Firestore Schema Specifications

The following definitions represent the complete production-grade schema structures for the MZ Health MVP.

### 1. Users Collection
* **Path:** `/users/{userId}`
* **Description:** Holds authenticated accounts, multi-role markers, and localization states.

```typescript
interface UserDocument {
  uid: string;                          // Firebase Auth identity key
  phoneNumber: string;                  // Standard format, e.g., "+88017XXXXXXXX"
  email?: string;                       // Optional email address
  displayName: string;                  // Full printable name
  role: 'super_admin' | 'admin' | 'doctor' | 'patient';
  isActive: boolean;                    // Admin soft-ban flag
  languagePreference: 'bn' | 'en';      // Presets app UI localization
  createdAt: Timestamp;                 // System registration timestamp
  updatedAt: Timestamp;                 // System property update timestamp
  lastLoginAt: Timestamp;               // Last recorded device verification
}
```

---

### 2. Doctors Collection
* **Path:** `/doctors/{userId}` (Doctor ID maps exactly to User UserID)
* **Description:** Complete operational profile for healthcare practitioners containing clinical certifications.

```typescript
interface DoctorDocument {
  doctorId: string;                     // Matches parent users/{userId}
  bmdcRegNumber: string;                // Bangladesh Medical & Dental Council (BMDC) registration number
  bmdcVerified: boolean;                // Admin vetting status
  specialties: string[];                // E.g., ["Cardiology", "Internal Medicine"]
  qualifications: string[];             // E.g., ["MBBS", "FCPS (Cardiology)", "MD"]
  experienceYears: number;              // Years in active clinical practice
  bio?: string;                         // Brief professional introduction
  chambers: Array<{
    chamberId: string;                  // Random hash key identifying the specific facility
    name: string;                       // E.g., "Labaid Diagnostic, Dhanmondi"
    address: string;                    // Clinical physical address
    city: 'dhaka' | 'chittagong' | 'sylhet' | 'rajshahi' | 'khulna' | 'barisal' | 'rangpur' | 'mymensingh';
    consultationFee: number;            // Consultation cost (BDT)
    activeDays: Array<'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri'>;
    timeSlots: string[];                // Format: ["17:00-17:15", "17:15-17:30"]
  }>;
  totalAppointmentsCount: number;       // Sharded query performance counter cache
  ratingAverage: number;                // Aggregated review metrics
  createdAt: Timestamp; 
  updatedAt: Timestamp;
}
```

---

### 3. Patients Collection
* **Path:** `/patients/{userId}` (Patient ID maps exactly to User UserID)
* **Description:** Medical records archive containing demographic metadata, baseline metrics, and chronic checklists.

```typescript
interface PatientDocument {
  patientId: string;                    // Matches parent users/{userId}
  dateOfBirth: Timestamp;               // Clinical verification key for calculation of patient age
  gender: 'male' | 'female' | 'other';
  bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  emergencyContact: {
    name: string;                       // Primary contact fullname
    relationship: string;               // E.g., "Spouse", "Parent"
    phoneNumber: string;                // Standard format, "+880..."
  };
  allergies: string[];                  // E.g., ["Penicillin", "Dust"] -> Empty if none
  chronicDiseases: string[];            // E.g., ["Diabetes", "Asthma"] -> Empty if none
  weightKg?: number;                    // Dynamic dose factor
  heightCm?: number;                    // Metric heights indicators
  createdAt: Timestamp; 
  updatedAt: Timestamp;
}
```

---

### 4. Pharmaceutical Companies Collection
* **Path:** `/pharma_companies/pharma_{companyId}`
* **Description:** Authoritative manufacturer listings.

```typescript
interface PharmaCompanyDocument {
  companyId: string;                    // Unique clean company identifier
  nameEng: string;                      // E.g., "Beximco Pharmaceuticals Ltd"
  nameBng: string;                      // E.g., "বেক্সিমকো ফার্মাসিউটিক্যালস লিঃ"
  dgdaLicenseNum: string;               // Official DGDA Manufacturing Permit Number
  isLocal: boolean;                     // true if local, false if MNC
  status: 'active' | 'suspended';
  contactPhone: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### 5. Medicines Collection
* **Path:** `/medicines/{medicineId}` (Deterministic ID)
* **Description:** Clinical drug registry optimized for fast client search queries.

```typescript
interface MedicineDocument {
  medicineId: string;                   // Derived string: {manufacturer}-{brand}-{strength}
  brandNameEng: string;                 // English trade name (e.g., "Napa Extend")
  brandNameBng: string;                 // Bengali trade name (e.g., "নাপা এক্সটেন্ড")
  genericName: string;                  // Scientific compound (e.g., "Paracetamol")
  genericId: string;                    // Unified query code
  strength: string;                     // Core dose (e.g., "665 mg")
  dosageForm: string;                   // E.g., "Tablet", "Syrup", "Injection"
  pharmaCompanyId: string;              // References pharma_companies/pharma_{companyId}
  pharmaCompanyName: string;            // Denormalized name copy
  unitPriceBdt: number;                 // BDT price per single tablet/vial (e.g., 2.50)
  isPrescriptionRequired: boolean;      // Pharmacy sales classification
  indications: string[];                // Medical conditions addressed
  contraindications: string[];          // Structural safety boundaries
  sideEffects: string[];                // Standard clinical adverse reactions
  pregnancyCategory: 'A' | 'B' | 'C' | 'D' | 'X' | 'N';
  dosageInstructions: {
    adult: string;
    child?: string;
  };
  searchTokens: string[];               // Lowercase partial English prefixes
  bengaliSearchTokens: string[];        // Bengali letter prefix matrices
  darNum: string;                       // DGDA official approval registration code
  isActive: boolean;                    // Administrative availability state
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### 6. Diseases Collection
* **Path:** `/diseases/icd_{diseaseId}` (Identifier derived from ICD standards)
* **Description:** Localized medical lookup dictionary containing diagnostic references.

```typescript
interface DiseaseDocument {
  diseaseId: string;                    // Internal database code
  icdCode: string;                      // ICD Classification code (e.g., "I10" for Hypertension)
  icdVersion: 'ICD-10' | 'ICD-11';
  nameEng: string;                      // Clinical English name
  nameBng: string;                      // Clinical Bengali local term
  diseaseCategory: string;              // Analytical clinical category
  severityLevel: 'low' | 'moderate' | 'high' | 'critical';
  symptoms: string[];                   // Primary descriptors (e.g., ["Headache", "Fever"])
  symptomsBng: string[];                // Primary descriptors in Bengali (e.g., [“মাথাব্যথা”, “জ্বর”])
  emergencyWarningIndicators: string[]; // Red flag clinical markers requiring emergency evacuation
  treatmentGuidelines: {
    firstLineGenerics: string[];        // Array of genericIds
    clinicalNotes: string;              // Context instruction summary
  };
  searchTokens: string[];               // Query index variables
  bengaliSearchTokens: string[];        // Bengali query index arrays
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### 7. Appointments Collection
* **Path:** `/appointments/apt_{random_uuid}` (Entropy ID prevents hot spots)
* **Description:** Represents transactional medical bookings.

```typescript
interface AppointmentDocument {
  appointmentId: string;                // Primary booking reference
  doctorId: string;                     // References doctors/{userId}
  doctorName: string;                   // Denormalized doctor name
  patientId: string;                    // References patients/{userId}
  patientName: string;                  // Denormalized patient name
  chamberId: string;                    // Destination chamber ID (matches doctor's chamber configurations)
  chamberName: string;                  // Chamber display (e.g., "Labaid Diagnostics, Dhanmondi")
  scheduledDate: string;                // Date format: "YYYY-MM-DD"
  timeSlot: string;                     // E.g., "05:15 PM - 05:30 PM"
  serialNumber: number;                 // Queue designation inside current chamber schedule
  appointmentType: 'first_consultation' | 'follow_up' | 'report_show';
  status: 'booked' | 'completed' | 'cancelled' | 'no_show';
  cancellationReason?: string;
  consultationFeeBDT: number;           // Locked price point
  paymentStatus: 'pending' | 'completed' | 'refunded';
  paymentMethod?: 'bkash' | 'nagad' | 'card' | 'cash';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### 8. Prescriptions Collection
* **Path:** `/prescriptions/rx_{random_uuid}`
* **Description:** Secure electronic prescription archives.

```typescript
interface PrescriptionDocument {
  prescriptionId: string;               // Unique clinical identification
  appointmentId: string;                // References appointments/{appointmentId}
  doctorId: string;                     // Link mapping
  doctorDetailsDenormalized: {
    name: string;
    bmdcRegNumber: string;
    specialties: string[];
    qualifications: string[];
  };                                    // Locks clinical credentials at time of generation
  patientId: string;                    // Link mapping
  patientDetailsDenormalized: {
    name: string;
    ageAtPrescription: number;          // Historical snapshot of patient age (years)
    gender: 'male' | 'female' | 'other';
    weightKg?: number;                  // Historical snapshot of patient weight
  };                                    // Locks demographics at time of generation
  diagnoses: Array<{
    icdCode: string;                    // Diagnostic ICD identifier
    diseaseName: string;                // Human readable name copy
    notes?: string;                     // Clinic specific notes
  }>;
  medicinesPrescribed: Array<{
    medicineId: string;                 // References medicines/{medicineId}
    brandName: string;                  // Copied from drug database (e.g., Napa 500mg)
    genericName: string;                // Copied from drug database (e.g., Paracetamol)
    dosage: string;                     // Usage rule (e.g., "1+0+1" - morning+noon+night)
    timing: 'before_meal' | 'after_meal' | 'with_meal' | 'empty_stomach';
    durationDays: number;               // Length of medication course
    quantityToDispense: number;         // Dispensing target
    customInstructions?: string;        // Free-text clinic input
  }>;
  dietaryRestrictions?: string[];
  nextFollowUpSuggestedDays?: number;
  isFinalized: boolean;                 // true locks document against further updates/deletions
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### 9. Notifications Collection
* **Path:** `/notifications/ntf_{random_uuid}`
* **Description:** Represents localized user notifications such as alerts, appointment updates, or scheduling reminders.

```typescript
interface NotificationDocument {
  notificationId: string;               // Unique notification locator ID
  userId: string;                       // Direct delivery recipient routing key (References users/{userId})
  titleEng: string;                     // Notification subject in English
  titleBng: string;                     // Notification subject in Bengali
  bodyEng: string;                      // Full text message body in English
  bodyBng: string;                      // Full text message body in Bengali
  type: 'appointment_reminder' | 'prescription_ready' | 'billing_success' | 'system_alert';
  isRead: boolean;                      // Client consumption tracking state
  payload?: {
    appointmentId?: string;             // Deep link to appointment context
    prescriptionId?: string;            // Deep link to prescription context
  };                                    // Deep-linking structure for client shells
  createdAt: Timestamp;                 // Notification generation time
}
```

---

### 10. Settings Collection
* **Path:** `/settings/{userId}` (For user accounts) OR `/settings/sys_{config_key}` (For organizational constants)
* **Description:** Manages custom functional and operational parameters for individual accounts as well as platform-wide configuration variables.

```typescript
// Variant A: Personal UI Settings profile (DocumentID: {userId})
interface UserSettingsDocument {
  userId: string;                       // References users/{userId}
  pushNotificationsEnabled: boolean;    // Device push permission flag
  emailNotificationsEnabled: boolean;   // Email communications flag
  smsNotificationsEnabled: boolean;     // SMS alerting configuration flag
  accessibility: {
    highContrastMode: boolean;          // Accessibility toggle
    fontSizeScale: 'small' | 'medium' | 'large';
  };
  updatedAt: Timestamp;
}

// Variant B: Regional Platform configuration Constants (DocumentID: sys_global_config)
interface SystemSettingsDocument {
  configId: string;                     // Set explicitly to "sys_global_config"
  supportedCities: string[];            // E.g., ["dhaka", "chittagong", "sylhet"]
  vatRatePercentage: number;            // Applied BDT tax multipliers
  minimumConsultationFeeBDT: number;    // Absolute baseline clinic pricing rules (e.g., 200)
  maxPrescriptionRefillMonths: number;  // Safety baseline constraints (e.g., 6)
  updatedAt: Timestamp;
}
```

---

### 11. Audit Logs Collection
* **Path:** `/audit_logs/log_{random_uuid}` (Write-Once database log)
* **Description:** Immutable system audit trail designed for HIPAA/compliance reporting.

```typescript
interface AuditLogDocument {
  logId: string;                        // Unalterable primary key
  actorId: string;                      // Action initiator references users/{userId}
  actorRole: 'super_admin' | 'admin' | 'doctor' | 'patient' | 'system';
  actionType: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EMERGENCY_OVERRIDE';
  resourceTarget: 'users' | 'doctors' | 'patients' | 'appointments' | 'prescriptions' | 'medicines' | 'settings';
  resourceDocId: string;                // ID of target document
  payloadChanges?: {
    fieldsModified: string[];           // Properties changed
    previousStateMd5?: string;          // Cryptographic trace checksum of preceding data
    newStateMd5?: string;               // Cryptographic trace checksum of newly created data
  };
  ipAddress: string;                    // Device physical identifier
  userAgent: string;                    // Technical signature string
  timestamp: Timestamp;                 // System-bound immutable server generation time
}
```

---

## 3. High-Concurrency Denormalization Strategy

To achieve sub-second response times on low-bandwidth connections, MongoDB/Firestore NoSQL designs require specific, controlled denormalization.

### Structural Data Duplications Matrix

To eliminate complex queries and document joins during critical workflows, data parameters are synchronized across collections as follows:

```text
+------------------------+---------------------------------+------------------------------------------+--------------------------------+
| Origin Collection      | Target Destination              | Fields Duplicated                        | Sync Frequency & Strategy      |
+------------------------+---------------------------------+------------------------------------------+--------------------------------+
| users                  | doctors                         | displayName                              | Real-time trigger on modification|
| doctors                | appointments                    | doctorName, specialties[0] (main)        | Copied once at booking         |
| patients               | appointments                    | patientName                              | Copied once at booking         |
| pharma_companies       | medicines                       | pharmaCompanyName                        | Batch run on company update   |
| doctors                | prescriptions                   | Full Credentials Block                   | Read-only snapshot at execution|
| patients               | prescriptions                   | Name, calculatedAge, gender, weightKg    | Read-only snapshot at execution|
| medicines              | prescriptions                   | brandName, genericName, strength         | Immutable receipt at execution |
+------------------------+---------------------------------+------------------------------------------+--------------------------------+
```

### Strategic Integration Mechanisms
1. **The Booking Receipt Concept:** An appointment is treated as an immutable commercial receipt. Medical titles and specialty categories are copied directly into the appointment record at the time of booking. If the doctor subsequently modifies their profile or BMDC qualifications, historical bookings remain unaffected, eliminating the need for cascading updates.
2. **Clinical Snapshot Principle:** Prescriptions must capture the patient’s clinical metrics (specifically **age** and **body weight**) at the exact moment of evaluation. Referencing dry patient files dynamically is dangerous, as a pediatric patient's weight change could invalidate historical dosage safety records.

---

## 4. Scalability Configurations (1M+ Users)

Firestore Native utilizes high-throughput distributed database tables. Scale limits must be managed programmatically to prevent performance degradation under concurrent user spikes:

### 1. Multi-Shard Event Collectors (Distributed Counter Strategy)
In a high-throughput environment, thousands of patients can schedule appointments or view physician pages within the same hourly window. To prevent write contention limits:
* Subcollection `/doctors/{doctorId}/counters_shards` is provisioned to split counters across 10 virtual shards.
* Dynamic counter updates are distributed evenly using random shard selection:
  ```typescript
  const shardId = Math.floor(Math.random() * 10).toString();
  // Write operation targets doctors/{doctorId}/counters_shards/{shardId}
  ```
* Aggregated counts are periodically consolidated for display optimization.

### 2. High-Efficiency Queries & Offline Cursor Synchronization
* Off-network clients rely on standard paginated indexing. Dynamic list loaders strictly utilize cursor anchors (`startAfter(lastVisibleDoc)`) instead of linear counting logic.
* To ensure local device performance during search filtering for 100,000+ medicines, clients maintain a lightweight local database (`SQLight` or client-side storage index) containing subset attributes (Brand Name, Strength, Form, Price, Active Status) totaling ~1 KB per entry. The heavy clinical descriptions are loaded on-demand from the cloud only when a specific record detail is selected.

---

## 5. Security Architecture Implementation (Firestore Rules Structure)

```typescript
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Core validation helpers
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function getUserClaims() {
      return request.auth.token;
    }
    
    function hasRole(role) {
      return isAuthenticated() && getUserClaims().role == role;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // --- Module 1 & 2: Users & Settings ---
    match /users/{userId} {
      allow read: if isAuthenticated() && (isOwner(userId) || hasRole('super_admin') || hasRole('admin') || hasRole('doctor'));
      allow create: if isAuthenticated() && isOwner(userId) && request.resource.data.role == 'patient';
      allow update: if isOwner(userId) && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role']);
      allow delete: if false; // Soft-delete patterns are required to preserve audit integrity
    }

    match /settings/{userId} {
      allow read, write: if isOwner(userId);
    }

    match /settings/sys_global_config {
      allow read: if isAuthenticated();
      allow write: if hasRole('super_admin') || hasRole('admin');
    }

    // --- Module 3: Doctors Management ---
    match /doctors/{doctorId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && isOwner(doctorId) && hasRole('doctor');
      allow update: if isOwner(doctorId) && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['bmdcVerified']);
      allow delete: if false;
    }

    // --- Module 4: Patient records ---
    match /patients/{patientId} {
      allow read: if isAuthenticated() && (isOwner(patientId) || hasRole('super_admin') || hasRole('admin') || hasRole('doctor'));
      allow create, update: if isOwner(patientId);
      allow delete: if false;
    }

    // --- Module 5, 6, 7: Catalogues (Medicines, Diseases, Companies) ---
    match /pharma_companies/{companyId} {
      allow read: if isAuthenticated();
      allow write: if hasRole('super_admin') || hasRole('admin');
    }

    match /medicines/{medicineId} {
      allow read: if isAuthenticated();
      allow write: if hasRole('super_admin') || hasRole('admin');
    }

    match /diseases/{diseaseId} {
      allow read: if isAuthenticated() && (hasRole('doctor') || hasRole('super_admin') || hasRole('admin'));
      allow write: if hasRole('super_admin') || hasRole('admin');
    }

    // --- Module 8: Transactional Bookings ---
    match /appointments/{appointmentId} {
      allow read: if isAuthenticated() && (
        request.auth.uid == resource.data.patientId || 
        request.auth.uid == resource.data.doctorId || 
        hasRole('super_admin') || 
        hasRole('admin')
      );
      allow create: if isAuthenticated() && request.resource.data.patientId == request.auth.uid;
      allow update: if isAuthenticated() && (
        request.auth.uid == resource.data.patientId || 
        request.auth.uid == resource.data.doctorId || 
        hasRole('admin')
      );
      allow delete: if false;
    }

    // --- Module 9: Clinical Prescriptions ---
    match /prescriptions/{prescriptionId} {
      allow read: if isAuthenticated() && (
        request.auth.uid == resource.data.patientId || 
        request.auth.uid == resource.data.doctorId || 
        hasRole('super_admin') || 
        hasRole('admin')
      );
      allow create: if hasRole('doctor') && request.resource.data.doctorId == request.auth.uid;
      allow update: if hasRole('doctor') && 
                    resource.data.doctorId == request.auth.uid && 
                    resource.data.isFinalized == false; // Prevent update once clinically committed
      allow delete: if false; // Strict compliance lock
    }

    // --- Module 10: Notifications ---
    match /notifications/{notificationId} {
      allow read, update: if isAuthenticated() && resource.data.userId == request.auth.uid;
      allow create: if hasRole('super_admin') || hasRole('admin') || hasRole('system');
      allow delete: if isAuthenticated() && resource.data.userId == request.auth.uid;
    }

    // --- Module 11: Compliance Logging Trace ---
    match /audit_logs/{logId} {
      allow create: if isAuthenticated() && request.resource.data.actorId == request.auth.uid;
      allow read: if hasRole('super_admin') || hasRole('admin');
      allow update, delete: if false; // Absolute immutability lock enforces compliance
    }
  }
}
```

---
**Approved & Signed By:**
*Principal Firestore Architect, MZ Systems*
