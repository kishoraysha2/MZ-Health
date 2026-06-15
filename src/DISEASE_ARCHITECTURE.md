# Bangladesh National Disease Intelligence System (BMIS)
## Sprint 3D: Disease Intelligence Foundation & Clinical Ontology Specification

**Authors:** Chief Healthcare Architect, Senior Firebase Architect, Bangladesh Healthcare Systems Architect  
**Status:** Approved & Frozen for Implementation  
**Version:** 3.3.0  

---

## 1. Architectural Vision & National Health Context

To power a national-scale digital health infrastructure serving **10 million+ citizens** under the guidance of the Bangladesh Ministry of Health and Family Welfare (MOHFW), BMIS implements the **National Disease Intelligence System (NDIS)**. 

Clinical terminology and symptom profiles must be isolated from comercial product indices and corporate structures to maintain clinical integrity and compute speed. During clinical diagnostic episodes, doctors, e-prescription systems, and triage chatbots require instant, sub-50ms access to disease catalogs, triage urgency ratings, and therapeutic guidelines.

By establishing a normalized, tier-based clinical ontology schema, Sprint 3D connects diagnostic intelligence to the existing pharmaceutical and regulatory rails of Sprints 3A, 3B, and 3C, establishing a seamless clinical workflow:

$$\text{Symptom/Triage Assessment} \longrightarrow \text{Disease Diagnosis (ICD-10/11)} \longrightarrow \text{Specialist Referral} \longrightarrow \text{Generic Molecule (Prescription)}$$

---

## 2. Multi-Tier Disease Collections (TypeScript & JSON Blueprints)

### 2.1 Collection: `diseases`
The Master Diagnostic Ledger. Contains detailed clinical symptom patterns, emergency indicators, prevention guidelines, and ICD-10/11 mappings.

```typescript
export type EmergencyClassification = 'normal' | 'urgent' | 'emergency';

export interface Disease {
  diseaseId: string;                    // Unique clinical key (e.g., "DIS-DENGUE-FEVER", "DIS-DIABETES-T2")
  diseaseNameEnglish: string;            // Standard English medical name (e.g., "Dengue Fever")
  diseaseNameBengali: string;            // Official Bengali medical translation (e.g., "ডেঙ্গু জ্বর")
  icd10: string;                         // ICD-10 Classification Code (e.g., "A90")
  icd11: string;                         // ICD-11 Classification Code (e.g., "1D20")
  symptoms: string[];                    // Standardized symptoms array (e.g., ["High Fever", "Severe Headache", "Joint Pain"])
  causes: string[];                      // Core etiological factors (e.g., ["Aedes mosquito bite", "Dengue Virus"])
  riskFactors: string[];                 // Predisposing factors (e.g., ["Stagnant water near residence", "Low immunity"])
  prevention: string[];                  // Preventative healthcare guidelines (e.g., ["Use mosquito nets", "Clear stagnant water"])
  severityLevel: 'low' | 'moderate' | 'high' | 'critical'; // Baseline clinical severity classification
  emergencyWarnings: string[];           // Immediate red flag symptoms (e.g., ["Persistent vomiting", "Mucosal bleeding"])
  searchTokens: string[];                // Calculated multi-language indexing prefixes (English)
  bengaliSearchTokens: string[];         // Calculated multi-language indexing prefixes (Bengali)
  createdAt: string;                     // ISO 8601 Timestamp of creation
  updatedAt: string;                     // ISO 8601 Timestamp of modification
}
```

### 2.2 Collection: `disease_catalogs`
A read-optimized, stripped-down lookup collection. It ensures sub-50ms latency for mobile and offline search queries by excluding complex clinical descriptions and symptom arrays, reducing payload sizes by **85%+**.

```typescript
export interface DiseaseCatalog {
  diseaseId: string;                    // Foreign Key pointing to `diseases.diseaseId`
  diseaseName: string;                   // Localized display name (English/Bengali based on context)
  severityLevel: 'low' | 'moderate' | 'high' | 'critical';
  emergencyLevel: EmergencyClassification; // Normal, Urgent, or Emergency triage state
  searchTokens: string[];                // Compact prefix token array for search inputs
  bengaliSearchTokens: string[];         // Compact Bengali prefix token array for search inputs
}
```

---

## 3. Disease Subcollection Relationships

To prevent document size bloat and bypass Firestore's 1MB limit while maintaining clinical integrity, the association between diseases, recommended clinical specialists, and approved chemical molecules is managed via highly structured, cascading subcollections.

```
+------------------------------------------------+
|                   diseases                     |
+------------------------------------------------+
| PK: diseaseId                                  |
+-----------------------+------------------------+
                        |
                        | 1-to-Many Subcollection
                        v
+------------------------------------------------+
|  diseases/{diseaseId}/recommended_specialists  |
+------------------------------------------------+
| PK: specialistId  (e.g., "SPEC-CARDIOLOGIST")  |
+-----------------------+------------------------+
                        |
                        | 1-to-Many Subcollection
                        v
+------------------------------------------------+
| diseases/{diseaseId}/recommended_specialists/  |
|      {specialistId}/recommended_generics       |
+------------------------------------------------+
| PK: genericId     (e.g., "GEN-ATORVASTATIN")   |
+------------------------------------------------+
```

### 3.1 Specialist Subcollection: `recommended_specialists`
* **Path:** `/diseases/{diseaseId}/recommended_specialists/{specialistId}`
* Maps the clinical specialty responsible for diagnosing and treating this condition in the Bangladesh healthcare environment.

```typescript
export interface RecommendedSpecialist {
  specialistId: string;                  // System specialist key (e.g., "SPEC-CARDIOLOGIST", "SPEC-PEDIATRICIAN")
  specialistNameEnglish: string;         // E.g., "Cardiologist"
  specialistNameBengali: string;         // E.g., "হৃদরোগ বিশেষজ্ঞ"
  priorityOrder: number;                  // Triage routing hierarchy (1 = Primary referral, 2 = Secondary referral)
  createdAt: string;
}
```

### 3.2 Approved Generics Subcollection: `recommended_generics`
* **Path:** `/diseases/{diseaseId}/recommended_specialists/{specialistId}/recommended_generics/{genericId}`
* Links the diagnostic specialty directly to the approved chemical compound classes (`medicine_generics`) established in **Sprint 3B**.

```typescript
export interface RecommendedGeneric {
  genericId: string;                     // Foreign key matching `medicine_generics.genericId` (e.g., "GEN-PARACETAMOL")
  genericNameEnglish: string;            // Denormalized generic text for single-read execution
  dosageProtocolEnglish: string;         // Standard clinical guidance for this specific disease
  dosageProtocolBengali: string;         // Standard clinical guidance in Bengali
  contraindicationsCheck: string[];      // Compound-specific checks (e.g., avoid NSAIDs in hemorrhagic states)
  isFirstLineTherapy: boolean;           // True: Golden Standard, False: Secondary alternative
  createdAt: string;
}
```

---

## 4. Emergency Classification & Triage Routing

Clinical safety requires clear, unambiguous triage classification. We define three strict operational emergency levels:

```
+---------------------------------------------------------------------------------+
|                                 TRIAGE GATEWAY                                  |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  [ NORMAL ]       --> Routine appointment scheduler routing.                     |
|  (e.g., Mild Cough)                                                             |
|                                                                                 |
|  [ URGENT ]       --> Telemedicine priority channel queue.                      |
|  (e.g., High Fever)   Advises home care plus immediate tele-clinical consults.  |
|                                                                                 |
|  [ EMERGENCY ]    --> Emergency Red-Flag Trigger. Bypasses queues.              |
|  (e.g., Chest Pain)   Displays immediate hospital coordinates, maps,           |
|                       and ambulance dispatcher hotlines.                        |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

1. **`normal`**:
   * **Definition**: Chronic or minor illnesses requiring non-urgent clinical diagnostics (e.g., Dyspepsia, Osteoarthritis).
   * **Routing**: Directs users to the regular **Appointment System** scheduler to secure outpatient visits.
2. **`urgent`**:
   * **Definition**: Acute conditions requiring timely expert care to prevent deterioration, but not actively life-threatening (e.g., Influenza with high fever, acute non-hemorrhagic diarrhea).
   * **Routing**: Flags the record inside patient interfaces, suggesting immediate prioritization via the **Telemedicine** network.
3. **`emergency`**:
   * **Definition**: High-risk, immediate life-threatening physiological crises (e.g., Myocardial Infarction, Dengue Hemorrhagic Shock Syndrome, Acute respiratory blockages).
   * **Routing**: Renders prominent red-alarm triage banners. Disables standard scheduling steps, presenting contact lines for local emergency departments, active ambulance coordinators, and emergency warning parameters.

---

## 5. Bilingual Search Architecture & Linguistic normalizations

To support dynamic search queries under varying field conditions in rural and urban Bangladesh, search metadata are pre-compiled on document write.

### 5.1 Ingestion Indexing Pipelines
When a disease document is registered or edited, the ingestion pipeline processes the brand configurations into multi-lingual edge-n-gram search tokens:

```typescript
// English Processing Pipeline (e.g., "Cholera" with ICD code "A00")
searchTokens: [
  "c", "ch", "cho", "chol", "chole", "choler", "cholera",
  "a00", "a0",                     // ICD-10 quick parameters
  "vibr", "vibrio", "diarrhea"     // Relevant etiology and symptom hooks
]

// Bengali Processing Pipeline (e.g., "কলেরা" / "ডায়রিয়া")
bengaliSearchTokens: [
  "ক", "কপ", "কলে", "ক্লেরা", "কলেরা",
  "ড", "ডা", "ডায়", "ডায়রি", "ডায়রিয়া",
  "পাতলা", "পায়খানা"                // Local colloquial terms for high-matching rates
]
```

### 5.2 Phonetic Mapping & Transliteration
* **Dual-Language Interconnectivity**: When a patient types `ডেঙ্গু` with Latin keys ("Dengue" or "Dengu"), the index leverages an acoustic Double-Metaphone translation map to resolve the phonetically matched Bengali entry `DIS-DENGUE-FEVER`.
* **Joint Ligature Normalization**: Bengali characters containing conjuncts (যেমন: ‘যক্ষ্মা’ বা ‘অ্যাজমা’) are decomposed and normalized to canonical Unicode representations to safeguard against typing style variations across operating systems.

---

## 6. Future Compatibility Matrix & Integration Maps

NDIS acts as the central clinical directory across all existing and future BMIS modules:

```
                  +--------------------------------+
                  |    NDIS Disease Intelligence   |
                  +---------------+----------------+
                                  |
         +------------------------+------------------------+
         |                                                 |
         v                                                 v
+-------------------------+                       +-------------------------+
|      E-Prescription     |                       |    Appointment System   |
+-------------------------+                       +-------------------------+
| Diagnostic ICD code    |                       | Suggests matching expert|
| mapping; safe generic   |                       | medical specialties based|
| warning verification.   |                       | on referral mapping.    |
+-------------------------+                       +-------------------------+
         |                                                 |
         v                                                 v
+-------------------------+                       +-------------------------+
|  Medicine Intelligence  |                       |       AI Assistant      |
+-------------------------+                       +-------------------------+
| Cross-references        |                       | Standard symptoms arrays|
| recommended generics    |                       | provide clinical grounding|
| with active brands.     |                       | for diagnostic triage.  |
+-------------------------+                       +-------------------------+
```

1. **Medicine Intelligence**: When a diagnostic code (e.g. `icd10: "A90"`) is applied to a patient file, the clinical engine resolves the disease's `/recommended_specialists` and matches `/recommended_generics(genericId)`. It then references `/medicine_catalogs` to suggest safe, active commercial brands.
2. **E-Prescription**: During electronic prescription formulation, the database performs checks. If a patient is diagnosed with renal failure, the prescription system scans the disease's clinical warnings, alerting the physician if recommended medicines are flagged as contraindicated.
3. **AI Assistant**: Conversational medical LLMs use the standardized symptoms arrays, emergency warnings, and prevention factors of the `diseases` collection to ground clinical recommendations, eliminating hallucination risks.
4. **Appointment System**: When a triage assessment points to a specific disease, the system queries the associated `recommended_specialists` list. It then filters doctor rosters by specialty (e.g., Cardiology, Dermatology), allowing patients to book appointments with appropriate experts in their region.
5. **Telemedicine**: In case of `emergency` triage results, the system routes the user to active telemedicine networks, providing clinical notes built directly from the symptom checklist.

---

## 7. Standard Composite Indexes

To support paginated search feeds, triage categorization, and filtering by severity, the following composite indexes must be defined in the system's `firestore.indexes.json` file:

```json
{
  "indexes": [
    {
      "collectionGroup": "diseases",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "severityLevel", "order": "ASCENDING" },
        { "fieldPath": "diseaseNameEnglish", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "disease_catalogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "emergencyLevel", "order": "ASCENDING" },
        { "fieldPath": "diseaseName", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## 8. Scalability & Technical Performance Specifications

Operating with **100,000+ clinical items** and serving **10 million+ concurrent Citizens**:
* **Bypassing Read-Amplification**: Complex components read exclusively from the streamlined `disease_catalogs` to avoid deep document parsing penalties. Complete `diseases` records are loaded only on specific clinical drill-down actions.
* **Typesense Clustering**: For instant fuzzy suggestions and auto-completions, updates to `disease_catalogs` trigger Cloud Functions that synchronize changes with high-speed **Typesense** or **Algolia** endpoints, keeping query times under **30ms**.
* **Edge CDN Distribution**: Since national disease indices are relatively static, catalog definitions are pre-compiled and cached on regional CDN locations (Cloud CDN), reducing direct Firestore read footprints during search spikes.

---

## 9. Comprehensive Security & Access Controls (Zero-Trust)

To guarantee database integrity and prevent unauthorized modifications to critical clinical resources, the system implements a hardened attribute-based ruleset:

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

    // Default Deny Ruleset Security Gate
    match /{document=**} {
      allow read, write: if false;
    }

    // 1. Disease Master Collection Rules
    match /diseases/{diseaseId} {
      allow read: if true; // Public access to healthcare ontology
      allow write: if isSystemAdmin(); // Locked for medical validity

      // 1.1 Recommended Specialists Subcollection Rules
      match /recommended_specialists/{specialistId} {
        allow read: if true;
        allow write: if isSystemAdmin();
      }

      // 1.2 Approved Generics Subcollection Rules
      match /recommended_generics/{genericId} {
        allow read: if true;
        allow write: if isSystemAdmin();
      }
    }

    // 2. High-speed Search Cache Projections
    match /disease_catalogs/{diseaseId} {
      allow read: if true;
      allow write: if isSystemAdmin();
    }
  }
}
```
