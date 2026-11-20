# Support Group Roster Management (BMC Helix ITSM 26.2 Integration)

A specialized enterprise web application engineered to manage schedules, shifts, leave, and on-call assignments for members of BMC Helix ITSM Support Groups outside of BMC Helix, dynamically calculating assignment availability and reconciling state with BMC Helix ITSM version 26.2.

---

## 1. System Architecture & Flow

```
+-----------------------------------------------------------------------------------+
|                                Browser / Web UI                                   |
|   Next.js App Router (React 19, Tailwind CSS, Lucide Icons, Dev Role Switcher)   |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                                Next.js Server                                     |
|  +-----------------------+  +-----------------------+  +----------------------+   |
|  | Authorization Service |  |     Roster Service    |  | Availability Engine  |   |
|  | (RBAC & Group Scoping)|  | (Overlaps & Shifts)   |  | (Precedence Matrix)  |   |
|  +-----------------------+  +-----------------------+  +----------------------+   |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  |                          Synchronization Engine                             |  |
|  |     - In-Memory Concurrency Mutex                                           |  |
|  |     - Change Detection (Desired Availability vs Current BMC Helix State)     |  |
|  |     - Dry-Run Simulation Mode                                               |  |
|  |     - Background Interval & Event-Triggered Sync                            |  |
|  +-----------------------------------------------------------------------------+  |
|                                        |                                          |
|               +------------------------+------------------------+                 |
|               v                                                 v                 |
|      +-----------------+                              +--------------------+      |
|      |   Prisma ORM    |                              | BMC Helix Provider |      |
|      |    (SQLite)     |                              |   Abstraction      |      |
|      +-----------------+                              +--------------------+      |
+-----------------------------------------------------------------|-----------------+
                                                                  |
                                                                  v
                                                        +-------------------+
                                                        |  BMC Helix 26.2   |
                                                        |  (System of Record|
                                                        |  for Directory &  |
                                                        |  Live Routing)    |
                                                        +-------------------+
```

### Separation of System Responsibilities

| System of Record (BMC Helix ITSM) | System of Record (Roster Management App) |
| :--- | :--- |
| People directory & profiles | Weekly & daily rosters |
| Support Group definitions | Shift schedules & overnight shifts |
| Functional support group memberships | Leave, off-duty, and on-call schedules |
| Live ticket assignment routing | Temporary availability overrides |
| Live assignment availability confirmation | Calculated desired availability & sync history |
| Global ITSM business rules | Full administrative and change audit trails |

---

## 2. Technology Stack

- **Framework**: Next.js 16 (App Router, Turbopack, Route Handlers)
- **Language**: TypeScript (strict configuration)
- **Styling**: Tailwind CSS with custom slate/indigo palette
- **Database & ORM**: Prisma ORM with SQLite (`dev.db`) designed for seamless PostgreSQL migration
- **Validation**: Zod schema validation on all inputs and API payloads
- **Testing**: Vitest with comprehensive unit and integration suites
- **Logging**: Structured JSON logger with automatic token and sensitive data redaction

---

## 3. Directory Structure

```
├── prisma/
│   ├── schema.prisma              # Database models with cross-database conventions
│   └── seed.ts                    # Realistic demo seed data (Groups, People, Rosters)
├── src/
│   ├── app/                       # Next.js App Router pages and API routes
│   │   ├── admin/
│   │   │   ├── authorizations/    # Manager-to-Group assignment UI
│   │   │   ├── integration/       # BMC Helix sync status & requirements UI
│   │   │   └── settings/          # Policies and synchronization settings UI
│   │   ├── api/                   # Server Route Handlers (REST endpoints)
│   │   │   ├── admin/             # Authorizations & Settings APIs
│   │   │   ├── auth/              # Dev role switching & current session APIs
│   │   │   ├── dashboard/         # Aggregated KPI and overview metrics
│   │   │   ├── overrides/         # Temporary override creation & cancellation
│   │   │   ├── people/            # Synchronized personnel directory API
│   │   │   ├── roster/            # Roster CRUD, bulk copy & validation
│   │   │   ├── support-groups/    # Support groups directory API
│   │   │   ├── sync/              # Manual, dry-run, retry & directory sync
│   │   │   └── sync-history/      # Historical sync execution logs API
│   │   ├── audit/                 # Audit trail browser with JSON diff inspection
│   │   ├── dashboard/             # Executive operations & status dashboard
│   │   ├── my-roster/             # Personal schedule view for individual users
│   │   ├── people/                # People directory view
│   │   ├── roster/                # Interactive weekly support group roster grid
│   │   ├── support-groups/        # Support group catalogue
│   │   └── sync-history/          # Synchronization log viewer & retry console
│   ├── components/                # Reusable UI components
│   │   └── layout/                # Navbar, Sidebar, RoleSwitcher, DevelopmentBanner
│   ├── domain/                    # Pure domain models and core calculations
│   │   ├── availability/          # AvailabilityEngine & calculation types
│   │   ├── roster/                # Roster types, shift definitions, and inputs
│   │   ├── support-group/         # Group domain models
│   │   └── synchronization/       # Sync domain structures
│   ├── integrations/
│   │   └── bmc-helix/             # BMC Helix 26.2 client & provider implementations
│   │       ├── authentication.ts  # Token caching, lifecycle, and renewal
│   │       ├── client.ts          # Unified factory client
│   │       ├── interfaces.ts      # Provider contracts
│   │       ├── mock-provider.ts   # In-memory mock provider for local development
│   │       └── not-configured-provider.ts # Strict guardrail for unconfigured live mode
│   ├── lib/
│   │   ├── config.ts              # Type-safe Zod runtime configuration
│   │   ├── database.ts            # Prisma singleton client
│   │   ├── dates.ts               # Shift interval & overnight calculations
│   │   └── errors.ts              # Custom typed application error hierarchy
│   └── server/
│       ├── auth/                  # Dev session management and role definitions
│       ├── authorization/         # Centralized RBAC and group scoping service
│       ├── jobs/                  # Background synchronization reconciliation job
│       ├── logging/               # Safe structured JSON logger
│       └── services/              # Core business services
│           ├── auditService.ts    # Audit logging service
│           ├── availabilityService.ts # Availability calculation orchestrator
│           ├── directorySyncService.ts # BMC Helix directory sync service
│           ├── overrideService.ts # Manual override service
│           ├── rosterService.ts   # Shift management & overlap validator
│           └── syncService.ts     # BMC Helix sync orchestrator with mutex
└── tests/
    ├── authorization/             # RBAC and group scoping test suite (10 tests)
    ├── availability/              # AvailabilityEngine precedence test suite (20 tests)
    ├── dates/                     # Shift intervals & overnight tests (5 tests)
    ├── roster/                    # RosterService overlap & conflict tests (5 tests)
    └── synchronization/           # SyncService integration test suite (2 tests)
```

---

## 4. User Roles & Server-Side Authorization

The application enforces server-side Role-Based Access Control (RBAC) across all service methods and route handlers:

1. **`ROSTER_USER`**:
   - Access to personal schedule via `/my-roster`.
   - View calculated availability status.
   - Strictly forbidden from modifying rosters, overrides, or triggering synchronizations.

2. **`ROSTER_MANAGER`**:
   - View and manage rosters only for support groups explicitly assigned to them.
   - Create, edit, bulk-copy, and delete shifts.
   - Apply temporary availability overrides for their support group members.
   - View synchronization and audit records for authorized support groups.
   - Forbidden from modifying other managers' support groups or global settings.

3. **`ROSTER_ADMIN`**:
   - Unrestricted access across all support groups.
   - Assign and revoke manager authorizations (`/admin/authorizations`).
   - Configure application settings and synchronization policies (`/admin/settings`).
   - Trigger on-demand directory sync, availability sync, dry-run simulation, and retry failed syncs.
   - Review full audit logs and system configuration.

### Development Role Switcher
In development mode, a role switcher is embedded in the top navigation bar. It updates a secure development cookie (`roster_dev_user_id`), allowing instant switching between:
- **System Administrator** (`admin@solvnow.internal`, `ROSTER_ADMIN`)
- **Service Desk Manager** (`manager@solvnow.internal`, `ROSTER_MANAGER`)
- **Arun Kumar (Analyst)** (`arun.kumar@solvnow.internal`, `ROSTER_USER`)

---

## 5. Availability Engine Precedence Rules

The `AvailabilityEngine` evaluates desired assignment availability by applying the following deterministic precedence matrix:

1. **Active Manual Override**:
   - If an active `AvailabilityOverride` exists for the timestamp, its `forcedAvailability` takes absolute precedence over all roster shifts.
2. **Scheduled Leave or Weekly Off**:
   - If the active roster entry status is `LEAVE` or `WEEKLY_OFF`, desired availability is `No` (`UNAVAILABLE`).
3. **Active Working Shift**:
   - If the timestamp falls within a scheduled `WORKING` shift, desired availability is `Yes` (`AVAILABLE`).
4. **Active On-Call Schedule**:
   - Evaluated based on the `ON_CALL_AVAILABILITY_POLICY` setting:
     - `UNAVAILABLE` (Default): Marked `No` in BMC Helix (standby/escalation only).
     - `AVAILABLE`: Marked `Yes` in BMC Helix (receives direct auto-assignments).
5. **No Active Roster Entry**:
   - Evaluated based on the `MISSING_ROSTER_POLICY` setting:
     - `TAKE_NO_ACTION` (Default): Returns `SKIPPED`, leaving BMC Helix untouched.
     - `KEEP_CURRENT_BMC_STATE`: Preserves last-confirmed BMC state.
     - `SET_UNAVAILABLE`: Marks person `No` (`UNAVAILABLE`).

---

## 6. BMC Helix 26.2 Integration Safety Architecture

> [!IMPORTANT]
> The exact REST endpoints, AR form names, and internal Field IDs for updating functional support group assignment availability in BMC Helix ITSM version 26.2 are proprietary and customer-specific.
>
> To safeguard enterprise environments, this application adheres to a strict integration safety contract:
> 1. **Default Mode**: Operates against the fully-featured `MockBmcProvider` for end-to-end development, testing, and UI validation.
> 2. **Unconfigured Live Mode**: If switched to `BMC_PROVIDER_MODE=helix` without verified endpoint definitions, the `NotConfiguredBmcAvailabilityProvider` halts execution and throws `ConfigurationRequiredError`. It will never perform unverified HTTP calls or fabricate mock successes.

---

## 7. BMC Helix 26.2 Integration Information Required

To switch from mock mode to live BMC Helix ITSM version 26.2 REST communication, the BMC Helix System Administrator must provide the following parameters:

### A. Authentication & Gateway
- **Base URL**: e.g., `https://<customer>-restapi.onbmc.com`
- **Authentication Endpoint**: JWT Login URL (typically `/api/jwt/login`)
- **Authentication Method**: Admin user/password credentials or API Client Key / Secret
- **Token Header Format**: `Authorization: AR-JWT <token>`

### B. Directory Synchronization Endpoints (Read-Only)
- **People (CTM:People)**:
  - AR Form Name or REST Path (e.g., `/api/arsys/v1/entry/CTM:People`)
  - Field IDs:
    - `Person ID` (Field 1)
    - `Login Name` (Field 4 or Remedey Login ID)
    - `First Name`, `Last Name`, `Email Address`
    - `Profile Status` (e.g., Enabled / Proposed / Offline)
- **Support Groups (CTM:Support Group)**:
  - AR Form Name or REST Path (e.g., `/api/arsys/v1/entry/CTM:Support Group`)
  - Field IDs: `Support Group ID`, `Support Group Name`, `Company`, `Support Organization`
- **Functional Support Group Membership (CTM:Support Group Functional Roles / CTM:SupportGroupAssociation)**:
  - AR Form Name or REST Path (e.g., `/api/arsys/v1/entry/CTM:SupportGroupAssociation`)
  - Field IDs: `Person ID`, `Support Group ID`, `Assignment Availability` (Yes / No), `Status`

### C. Availability Mutation Endpoint (Write)
- **Form Name**: Specific BMC Helix form used to toggle availability for a person within a specific support group (e.g., `CTM:SupportGroupFunctionalRoles` or `CTM:SupportGroupAssociation`).
- **REST Method**: `PUT` or `POST`
- **Field ID for Assignment Availability**: The exact internal AR Field ID (e.g., Field `1000000080` or `Assignment Availability`) and accepted values (`"Yes"`, `"No"`, `0`, `1`).
- **Entry Identifier**: The unique Request ID or composite entry key needed to execute the `PUT` operation.

---

## 8. Setup & Local Development Run

### Prerequisites
- Node.js 18.18+ or 20+
- npm 9+

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default configuration values in `.env`:
```env
DATABASE_URL="file:./prisma/dev.db"
APP_ENV="development"
APP_TIMEZONE="Asia/Kolkata"
MISSING_ROSTER_POLICY="TAKE_NO_ACTION"
ON_CALL_AVAILABILITY_POLICY="UNAVAILABLE"
SYNC_INTERVAL_MINUTES=15
DRY_RUN_DEFAULT=false
BMC_PROVIDER_MODE="mock"
```

### 3. Initialize & Seed Database
Generate the Prisma client, apply schema to SQLite, and seed realistic demo data:
```bash
npx prisma db push
npx tsx prisma/seed.ts
```

### 4. Run Test Suite
Run all unit and integration tests (42 passing tests):
```bash
npx vitest run
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 9. Verification & Quality Assurance

- **Unit & Integration Tests**: 42 automated tests covering:
  - AvailabilityEngine precedence and transition rules
  - Overnight shift boundary calculations (22:00 to 06:00 across UTC day changes)
  - Duplicate shift and overlapping shift rejection in RosterService
  - Server-side RBAC authorization and group-scoping enforcement
  - Dry-run simulation and change-detection logic
- **TypeScript**: Strict typechecking (`npx tsc --noEmit`) passes with 0 errors.
- **Production Build**: Clean compilation via Next.js Turbopack (`npm run build`).
