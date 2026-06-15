# MZ Health - Role-Based Access Control (RBAC) & Security Architecture Specification

## Document Metadata
* **Project Name:** MZ Health
* **Entity:** MZ Systems (Bangladesh)
* **Author:** Senior Security Architect
* **Date:** June 13, 2026
* **Security Frameworks:** National Cyber Security Policy of Bangladesh, GDPR, and HIPAA (Healthcare Security Standards)
* **Database Platform:** Google Cloud Firestore & Firebase Authentication

---

## 1. Executive Summary & Design Principles

This specification details the cryptographic identity, role management, and access authorization models for **MZ Health**. Designed for the complex and sensitive healthcare landscape of Bangladesh, the architecture implements dual layers of validation: **Authentication-level Custom Claims** (via Firebase Auth) and **Data-level Security Declarations** (via Firestore Rules).

The security modeling is steered by five immutable pillars:
1. **The Principle of Least Privilege (PoLP):** No entity is granted access to read, mutate, or audit information beyond the minimal scope required to fulfill their healthcare or operating administrative function.
2. **Attribution & Non-Repudiation:** Every read, write, and authentication mutation is uniquely attributed to a physical, verified user identity and securely recorded into an unalterable audit log. No shared clinical identities or generic institutional credentials are permitted.
3. **Data Integrity & Immutability:** Diagnostic and prescription records must be protected from dynamic retroactive altering. Once clinically finalized, prescriptions must be physically locked against updates and deletions.
4. **Clinical Priority (The "Break-the-Glass" Principal):** While patient privacy is strictly guarded, medical systems must incorporate specific, auditable emergency clinical access override routes for life-critical scenarios.
5. **Regulatory Compliance Alignment:** Designed to satisfy international data privacy standards adapted for local frameworks within the Digital Security Act of Bangladesh and the Ministry of Health and Family Welfare (MOHFW) guidelines.

---

## 2. Definitive RBAC Matrix & Permission Directory

### Identity Catalog (Dynamic Lifecycle Matrix)
The user lifecycle spans current core profiles and forward-compatible specialized operators:

| ID | Role Prefix | Access Character | Clinical Assignment | Current/Future Phase |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `super_admin` | Administrative | Platform Governance, Infrastructure Control | Current (MVP v1) |
| **2** | `admin` | Operations | Operational Audit, Clinical Verification, Registry Setup | Current (MVP v1)|
| **3** | `doctor` | Medical / clinical | Patient Evaluation, Treatment execution, Diagnostic ordering | Current (MVP v1) |
| **4** | `patient` | End User | Personal Profile oversight, Appointment Booking, Records Retrieval | Current (MVP v1) |
| **5** | `pharmacist` | Dispensing | Medication Dispensing, Inventory Management, Drug Interaction Check | Phase 2+ (Future) |
| **6** | `lab_tech` | Diagnostic | Order Fulfillment, Pathology Entry, Specimen Log Tracking | Phase 2+ (Future) |
| **7** | `insurance` | Claim Reviewer | Policy Verification, Coverage Allocation, Copay Processing | Phase 2+ (Future) |
| **8** | `blood_coord` | Logistical | Donor Registry Management, Compatibility Search, Unit Allocation | Phase 2+ (Future) |
| **9** | `support` | Maintenance | Identity Resolution, Session Debugging, Chamber Verification | Phase 2+ (Future) |
| **10**| `auditor` | Compliance | Immutable Security Review, Privacy Violations Investigation | Phase 2+ (Future) |

---

## 3. Collection Access Matrix (CRUD Mapping)

This matrix maps access permission classes to active NoSQL datasets. Permitted actions are categorized by:
* **C (Create):** Direct write generation of a brand-new document.
* **R (Read):** Individual retrieval (`get`) or compound querying (`list`).
* **U (Update):** Modifying existing non-primary keys within matching boundaries.
* **D (Delete):** Document erasure/purging.

```text
Permissive Access Mapping Key:
[✔] Permitted natively under context boundaries.
[✘] Restricted globally.
[C] Conditional permissions (Rules-based constraints apply).
```

| Collection Name | Action | Super Admin | Admin | Doctor | Patient | Pharmacist (P2)| Lab Tech (P2) | Auditor (P2) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **users** | **C** | ✔ | ✔ | [C1] | [C1] | [C1] | [C1] | ✘ |
| | **R** | ✔ | ✔ | [C2] | [C3] | [C2] | ✘ | ✔ |
| | **U** | ✔ | ✔ | [C4] | [C4] | [C4] | [C4] | ✘ |
| | **D** | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| **doctors** | **C** | ✘ | ✔ | [C4] | ✘ | ✘ | ✘ | ✘ |
| | **R** | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| | **U** | ✘ | ✔ | [C4] | ✘ | ✘ | ✘ | ✘ |
| | **D** | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| **patients** | **C** | ✘ | ✔ | ✘ | [C4] | ✘ | ✘ | ✘ |
| | **R** | ✔ | ✔ | [C5] | [C3] | [C5] | [C5] | ✔ |
| | **U** | ✘ | ✘ | [C6] | [C4] | ✘ | ✘ | ✘ |
| | **D** | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| **pharma_companies**| **C** | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ |
| | **R** | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ | ✔ |
| | **U** | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ |
| | **D** | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| **medicines** | **C** | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ |
| | **R** | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ | ✔ |
| | **U** | ✔ | ✔ | ✘ | ✘ | [C7] | ✘ | ✘ |
| | **D** | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| **diseases** | **C** | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ |
| | **R** | ✔ | ✔ | ✔ | [C8] | ✔ | ✘ | ✔ |
| | **U** | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ |
| | **D** | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| **appointments** | **C** | ✘ | ✔ | ✘ | ✔ | ✘ | ✘ | ✘ |
| | **R** | ✔ | ✔ | [C2] | [C3] | ✘ | ✘ | ✔ |
| | **U** | ✘ | ✔ | [C9] | [C9] | ✘ | ✘ | ✘ |
| | **D** | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| **prescriptions** | **C** | ✘ | ✘ | [C10]| ✘ | ✘ | ✘ | ✘ |
| | **R** | [C11] | [C11] | [C12]| [C3] | [C13]| ✘ | ✔ |
| | **U** | ✘ | ✘ | [C14]| ✘ | ✘ | ✘ | ✘ |
| | **D** | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| **audit_logs** | **C** | [C15] | [C15] | [C15]| [C15]| [C15]| [C15]| ✘ |
| | **R** | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✔ |
| | **U** | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| | **D** | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |

---

## 4. Logical Access Controls & Field Integrity Rules

The Access Matrix is governed by fifteen runtime contextual rules (`C1` through `C15`) evaluated directly within the API gateway layer or Firestore Rules interface:

* **[C1] Safe Identity Initialization:** Allows a user to create a basic `users` document only if the targeted Document ID matches their verified Firebase Auth UID (`request.auth.uid == userId`) and the onboarding role parameter is strictly locked to `patient`. Upgrade paths to higher status roles (`doctor`, `admin`) are strictly blocked.
* **[C2] Dynamic Clinical Sandbox:** Access is permitted only if the querying Doctor or Pharmacist has a confirmed appointment session with the target patient within a active window of +/- 24 hours.
* **[C3] Ownership Verification:** Access is permitted absolute and exclusive release of records if the targeting field is structurally assigned to the client's own identity parameters (`request.auth.uid == data.patientId` or `request.auth.uid == userId`).
* **[C4] Bound Isolation Modification:** Any user can modify structural administrative strings (e.g., preference string language, contact variables) on their **own** document node (`request.auth.uid == userId`). No modification of the root structural claims array (`role` property) is permitted.
* **[C5] Authorized Referral Search:** Active doctors can retrieve core anatomical values, chronic history data, and allergen checklists for patients, provided they possess a legitimate clinical booking reference matching the patient index.
* **[C6] Clinical Parameter Append:** Physicians can write vital updates (e.g., measuring patient weight, appending active allergen markers) directly to a patient file, but are blocked from rewriting administrative demographics or identification indicators.
* **[C7] Local Retail Stock updates:** Permitted only in future phase, granting active pharmacists the capability to modify physical inventory arrays and pricing parameters within their designated retail facility boundaries.
* **[C8] Transparent Disease Discovery:** Patients can read clinical descriptors, descriptions, and symptom indices to self-research. However, raw ICD clinical codes and specialized clinical directives (first/second-line generic maps) are protected from non-licensed visibility.
* **[C9] Secure Status Transition:** Status properties in the `appointments` registry are restricted by an explicitly safe state machine logic:
  * Patients can only update states from `booked` $\rightarrow$ `cancelled` (up to 2 hours before scheduled execution).
  * Doctors can transition states from `booked` $\rightarrow$ `completed` or `no_show`.
  * Admins possess override locks to reschedule or refund transactions directly.
* **[C10] Validated Doctor Writing:** Prescriptions can only be created by an account authenticated with the Custom Claim `role == "doctor"` who is verified by the BMDC licensing registry (`doctors/{doctorId}.bmdcVerified == true`).
* **[C11] Anonymized Compliance Reporting:** Super Admins can only parse aggregated trends or audit transactions. Direct user details must be dynamically masked unless an expert review is requested.
* **[C12] Professional Record Tracking:** In addition to current active patients, a doctor maintains read authorization on past clinical prescriptions issued by their own private cryptographic signatures.
* **[C13] Dispensing Check Out:** Active pharmacists can read prescription details matching a unique barcode presentation to cross-verify dose calculations before physical drugs are released.
* **[C14] Immutable Signature Locking:** Doctors can append, edit, or adjust medication modules inside their prescription document as long as the parameter `isFinalized == false`. Once written as `isFinalized == true`, the document transitions to a permanent system state where no further modifications are permitted.
* **[C15] Absolute Append-Only Stream:** The security engine enforces that `audit_logs` are strictly **write-once**. The rules block updates (any mutation of active states) and deletions completely.

---

## 5. Custom Claims Strategy (Firebase Authentication)

We isolate core authorization rules inside **Firebase Authentication Custom Claims**. This guarantees that access checks do not require expensive secondary reads of FireStore collections on every routing cycle.

### Custom Claims JSON Payload Structure
```json
{
  "role": "doctor",
  "bmdcVerified": true,
  "mfaEnabled": true,
  "tenantId": "mz-systems-bd"
}
```

### Lifecycle & Propagation Pattern
```text
  +----------------------+
  | Admin triggers       |
  | Doctor Verification  |
  +----------+-----------+
             |
             v (Cloud Func Backend Runs)
  +----------------------------------+
  | - Updates doctors/{id}           |
  | - Generates Firebase Custom Claim|
  +----------+-----------------------+
             |
             v (Token Force Refresh)
  +----------------------------------+
  | Client fetches fresh ID Token    |
  | incorporating verification state |
  +----------+-----------------------+
             |
             v (Firestore Ingress)
  +----------------------------------+
  | Rules intercept claim and authorize|
  | access instantly without query   |
  +----------------------------------+
```

1. **Claim Management Isolation:** Clients are strictly prohibited from writing to or altering custom claim nodes directly. The claims dictionary is modified exclusively via trusted server environments (Cloud Functions) executing after authentication assertions.
2. **Dynamic Tokens:** When an administrative operator verifies a doctor (`bmdcVerified` transitions to `true`), a server hook modifies the registration claims directory and publishes a message to reload user authorization states.
3. **MFA Enforcement:** Users authenticated with Administrative or Clinical roles are forced to resolve multi-factor challenges (mobile SMS-OTP verification in Bangladesh) prior to receiving highly prioritized claims permissions.

---

## 6. Firestore Security Model (Structure & Concepts)

We translates absolute RBAC permissions into logical rules matching Google Firebase’s native syntax.

### 1. Unified Identity Variable Ingestion
The Firestore engine provides access rules checking for authorization tokens and verified structures:

```typescript
// Conceptual Logical Rules Structure
function isAuthenticated() {
  return request.auth != null;
}

function getUserData() {
  return request.auth.token;
}

function matchesUserRole(targetRole) {
  return isAuthenticated() && getUserData().role == targetRole;
}

function isOwner(userId) {
  return isAuthenticated() && request.auth.uid == userId;
}
```

### 2. Implementation Logic for Sub-Collections

#### Core Directory Safety
```typescript
match /users/{userId} {
  allow read: if isOwner(userId) || matchesUserRole('super_admin') || matchesUserRole('admin');
  allow create: if isAuthenticated() && isOwner(userId) && request.resource.data.role == 'patient';
  allow update: if isOwner(userId) && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role']);
  allow delete: if false; // Deletions of physical identity records are prohibited for auditing
}

match /doctors/{doctorId} {
  allow read: if isAuthenticated();
  allow write: if matchesUserRole('super_admin') || matchesUserRole('admin');
}
```

#### Prescription Immutable Safeguard Implementation
```typescript
match /prescriptions/{prescriptionId} {
  // Read access rules
  allow read: if isAuthenticated() && (
    request.auth.uid == resource.data.patientId || 
    request.auth.uid == resource.data.doctorId || 
    matchesUserRole('super_admin') || 
    matchesUserRole('admin')
  );
  
  // Write and modify rules
  allow create: if matchesUserRole('doctor') && request.resource.data.doctorId == request.auth.uid;
  allow update: if matchesUserRole('doctor') && 
                  resource.data.doctorId == request.auth.uid && 
                  resource.data.isFinalized == false; // Protects historic documents once clinically locked
  allow delete: if false; // Structural prescription purges are strictly forbidden
}
```

---

## 7. Audit Logging Architecture

Compliance tracking requires registering user actions inside an isolated database partition. Common data logging models are designed to meet clinical data tracking directives.

### Ingestion Requirements
* **Standard Logs Tracking Schema:** All read actions on sensitive collections (`patients`, `prescriptions`) generate automated telemetry entries containing actor authentication coordinates, search filters, and targeted patient profiles.
* **Structural Masking of Changes:** Transaction logging records do not store private clinical attributes outright to prevent secondary leak surfaces. Modifications inside documents generate specific diff lists tracking changes, while protecting actual diagnostic values.

### Non-Repudiation Implementation Pattern
* **Database Lock Actions:** The database rule restricts write access to the `audit_logs` collection such that documents cannot be deleted or rewritten under any operational profile:
```typescript
match /audit_logs/{logId} {
  allow create: if isAuthenticated() && request.resource.data.actorId == request.auth.uid;
  allow read: if matchesUserRole('super_admin') || matchesUserRole('admin') || matchesUserRole('auditor');
  allow update: if false; // Mutation of historic tracking arrays is strictly blocked
  allow delete: if false; // Deletion of history tracking logs is strictly blocked
}
```

---

## 8. Clinical Emergency Access Model ("Break-the-Glass")

In critical medical departments (such as ICUs or emergency wards), a patient may present unconscious with missing authentication permissions or credentials. If clinical history is locked behind typical ownership validation rules, life-saving measures could be delayed.

To handle these scenarios, MZ Health implements a **"Break-the-Glass" (BTG)** security protocol. This protocol overrides strict consent rules during crisis events while enforcing deep post-action accountability.

### Standard BTG Lifecycle Flow
```text
                  +-----------------------------------+
                  | Patient arrives unconscious       |
                  | with critical medical records     |
                  +-----------------+-----------------+
                                    |
                                    v (BTG Triggered)
                  +-----------------------------------+
                  | Doctor selects "Break the Glass"  |
                  | input, selecting override rationale|
                  +-----------------+-----------------+
                                    |
                                    v (BTG Log Appended)
                  +-----------------------------------+
                  | Active write triggers:            |
                  | appointments/ {Temp Urgent Session}|
                  +-----------------+-----------------+
                                    |
                                    v (Security Grant)
                  +-----------------------------------+
                  | Read access validated for patient |
                  | files temporarily for 2 hours    |
                  +-----------------+-----------------+
                                    |
                                    v (Automated Warning)
                  +-----------------------------------+
                  | Critical event pushed to:         |
                  | Admin Console & Auditor alert queue|
                  +-----------------------------------+
```

### Architectural Controls
1. **The Temporary Override Session Document:** Rather than creating a permanent vulnerability, triggering "Break-the-Glass" writes an emergency token document inside a verified collection. This document records the Doctor's details, the Target Patient's ID, a medical justification code (e.g., "Cardiac Arrest - Unconscious"), and an expiration timestamp exactly 2 hours in the future.
2. **Logical Rule Verification:** The rules check this emergency collection dynamically to authorize immediate read access to the patient's record during that specific 2-hour window:
```typescript
function isEmergencyOverrideActive(patientId, doctorId) {
  return exists(/databases/$(database)/documents/emergency_overrides/$(patientId + '_' + doctorId)) &&
         get(/databases/$(database)/documents/emergency_overrides/$(patientId + '_' + doctorId)).data.expiresAt > request.time;
}
```
3. **Escalated Audit Loop:** BTG activation automatically flags the session as a critical security event, immediately routing alert messages to the **Auditor Console** and notifying designated facility administrators within minutes.

---
**Approved & Signed By:**
*Senior Security Architect, MZ Systems*
