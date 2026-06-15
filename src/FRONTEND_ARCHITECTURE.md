# MZ Health - React + Vite Frontend Architecture Specification

## Document Metadata
* **Project Name:** MZ Health (Super App for Bangladesh)
* **Parent Entity:** MZ Systems (Bangladesh)
* **Author:** Senior React Enterprise Architect
* **Date:** June 13, 2026
* **Database Platform:** Firebase Firestore & Authentication (Native Mode)
* **Frontend Ecosystem:** React 19, Vite, TypeScript, Tailwind CSS, React Router, React Query, Zustand

---

## 1. Enterprise Project Folder Structure

To scale to 1M+ users and multiple engineering teams, MZ Health utilizes a **feature-based (domain-driven) modular architecture**. Shared infrastructure is stored in global directories, while functional logic is isolated within logical feature domains.

```text
/src
├── assets/                 # Global static images, vectors, and localization json files
├── components/             # Reusable shared presentation components
│   ├── common/             # Platform-wide generic UI elements (Buttons, Inputs, Modals)
│   ├── layout/             # Universal shells (Footer, Header, Sidebar components)
│   └── feedback/           # Loading, skeletons, and specialized network fallback overlays
├── config/                 # Static variables, Firebase keys, environment configs
├── features/               # Bound functional modules (each self-contained)
│   ├── auth/               # Mobile OTP, login redirection, and claims parsing
│   ├── users/              # Onboarding profiles, password resets, personal preferences
│   ├── doctors/            # Verification queue, specialty listings, chamber setup
│   ├── patients/           # Metric tracking profiles, allergy files, history logs
│   ├── medicines/          # Brand search lists, local DGDA drug indices
│   ├── diseases/           # Symptom lookup directories, ICD-11 charts
│   ├── appointments/       # Slot finders, serial booking, payments
│   ├── prescriptions/      # Live editor, signature locking, prescription views
│   ├── notifications/      # Local alerting nodes, unread counts
│   └── settings/           # Personal settings configurations, global platform parameters
├── hooks/                  # Global convenience helpers (useDebounce, useNetworkStatus)
├── lib/                    # SDK definitions (db, auth configurations, api clients)
├── routes/                 # Direct system layouts and custom guard decorators
├── services/               # Dynamic external API proxies (payment gateways, OTP hubs)
├── store/                  # Client-side state engines (Zustand config slices)
├── types/                  # Shareable database and domain model definitions
├── utils/                  # Safe formatting methods (currency, dates, BDT symbols)
├── App.tsx                 # Core application controller
├── index.css               # Global styling directives (Tailwind & custom fonts)
└── main.tsx                # Single mount point configuration
```

---

## 2. Feature-Based (Domain) Component Design

Every directory within `/src/features/{feature_name}` behaves as an independent workspace. This guarantees strict boundary separation, preventing tightly coupled spaghetti dependencies.

### Directory Template Inside Each Feature
```text
/src/features/{feature_name}
├── components/             # Private presentational screens and card assets
├── hooks/                  # Feature-specific hooks wrapping React Query mutations or queries
├── repository/             # Concrete database read/write abstractions (Firestore Layer)
├── types/                  # Internal TypeScript schema extensions
└── index.ts                # Clean export gateway (facade) exposing only approved modules
```

#### Shared Feature Integration Guideline
* **Local Scope Isolation:** Components in `/src/features/medicines/` are strictly prohibited from importing items directly from `components/` directories of sibling features (e.g. `appointments`).
* **Approved Cross-Feature Interoperability:** If a component needs to access alternate metrics, it must import exclusively from the feature's primary facade index (`index.ts`).

---

## 3. Database Repository Pattern (Firestore Service Layer)

All interactions with Cloud Firestore must pass through a strict **Repository Layer**. React components are prohibited from calling raw Firestore SDK methods (e.g., `getDoc`, `setDoc`, `addDoc`) directly.

### Unified Repository Design Principles:
1. **Strong Typing:** Every read/write method accepts and returns explicit, validated TypeScript interfaces.
2. **Standardized Error Wrapping:** Every repository method wraps operations in a strict `try/catch` block, passing exceptions through a unified clinical logging handler to capture standard metadata.
3. **Optimized Network Fetch:** Repository methods implement deterministic `source` selection (`cache` vs. `server`) to support offline-first operational targets.

### Directory Structure of Repository Layer
```text
/src/features/prescriptions/repository
├── index.ts                # Aggregated namespace exporter
├── prescription.write.ts   # Mutations containing state transitions & signatures
└── prescription.read.ts    # Filter queries, patient listings, compliance auditing
```

---

## 4. Authentication & Custom Claims Architecture

MZ Health utilizes verified mobile numbers as the primary login identifier in Bangladesh, combined with secure Google Auth for administrators and clinicians.

### 1. Identity Verification Flow
* **Platform Entry:** Patient inputs mobile number $\rightarrow$ Backend initiates secure Firebase OTP verification code.
* **Role Verification:** Upon validation, the system reads `/users/{userId}` to identify role configuration.
* **Token Assertion:** High-security screens (e.g. Doctor Dashboard, Admin Console) force-refresh the Firebase JWT token, asserting that claims parameters (`role` and verification markers) match the profile strictly.

### 2. Guard Component Framework
Authorized access is enforced at the layout layer using standard **Authentication Guards**:
* `<RequireAuth>`: Ensures a valid logged-in session exists.
* `<RequireRole allowedRoles={['doctor']}>`: Conditionally mounts child components or performs immediate client-side redirects based on parsed token claims.

---

## 5. Client Route Architecture & Route Directory Map

Routing rules are managed declaratively using `react-router` nested routing paths.

```text
/
├── public/                 # Universal marketing page, medicine catalog search, doctor locator
├── auth/                   # Mobile OTP inputs, role choices, new patient profile registration
├── patient/ (Auth Guard)   # /patient/dashboard, /patient/appointments, /patient/prescriptions
├── doctor/ (Auth Guard)    # /doctor/dashboard, /doctor/queue, /doctor/prescription/new
└── admin/ (Auth Guard)     # /admin/verify-doctors, /admin/audit-logs, /admin/system-constants
```

---

## 6. Layout Architecture (Grid Shells)

We enforce standard screen configurations to maintain visual rhythm across desktop and mobile devices:

```text
+-------------------------------------------------------------+
|                                                             |
|                       GLOBAL HEADER                         |
|                                                             |
+-------------------------------------------------------------+
|  +--------------------+  +-------------------------------+  |
|  |                    |  |                               |  |
|  |                    |  |          MAIN CONTENT         |  |
|  |                    |  |             STAGE             |  |
|  |    PERSISTENT      |  |                               |  |
|  |    NAVIGATION      |  |                               |  |
|  |      RAIL          |  |                               |  |
|  |                    |  |                               |  |
|  |                    |  |                               |  |
|  +--------------------+  +-------------------------------+  |
+-------------------------------------------------------------+
|                                                             |
|                       GLOBAL FOOTER                         |
|                                                             |
+-------------------------------------------------------------+
```

### Layout Definitions:
1. **PublicLayout:** Maximizes standard display typography with centralized screen positioning.
2. **DashboardLayout:** Utilizes a persistent left-rail menu, breadcrumb indicators, responsive sidebars, and high-visibility action controls.

---

## 7. Client & Server State Management (Data Flow Matrix)

To minimize loading screens, data caching is split into two distinct tiers:

### 1. Client State (Zustand Store)
* **Target Data:** UI Theme selection, localization maps (`bn` / `en`), temporary checkout items, sidebar toggle states, and the current user's ephemeral authentication status.
* **Characteristics:** High-frequency, small volumetric footwork, local device persistence via `localStorage` adapters.

### 2. Server State (React Query / TanStack Query)
* **Target Data:** Dynamic listings of medicines, active diagnostic disease descriptions, current patient clinical history records, and active appointment queues.
* **Characteristics:** Automatic validation triggers, background data synchronization, automatic retry parameters on connection failure, and secure memory caching.

---

## 8. Enterprise Frontend Coding Standards

To ensure consistency across MZ Health codebases, developers must adhere to the following strict guidelines:

### Standard Code Declarations
* **Component Form:** All views must be developed as functional components using explicit Type assertions (`React.FC` or normal parameters declarations).
* **State Updates:** State modifications or value mutations must not be executed directly inside rendering cycles to prevent cascading infinite loops.
* **Strict Imports:** All imports are grouped at the top-level of the module using named imports.

### Error Handling & Skeletons
* **Suspense & Boundary Wrapping:** High-frequency components are wrapped inside `<ErrorBoundary>` panels paired with customized Tailwind loading skeletons to prevent partial application crashes from ruining user experience.
* **Localized Numeric Formats:** All BDT currencies use the standardized Bangladeshi notation using unified localized helper definitions.

---
**Approved & Signed By:**
*Senior React Enterprise Architect, MZ Systems*
