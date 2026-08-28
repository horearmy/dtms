# DTMS — Delivery Tracking Management System

Multi-tenant SaaS aplikasi manajemen pengiriman & logistik.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Architecture Overview](#architecture-overview)
- [Multi-Tenant System](#multi-tenant-system)
- [RBAC & Permissions](#rbac--permissions)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Frontend Pages](#frontend-pages)
- [Authentication Flow](#authentication-flow)
- [Billing & Subscriptions](#billing--subscriptions)
- [GPS Tracking](#gps-tracking)
- [Driver Mobile App](#driver-mobile-app)
- [Known Issues & Technical Debt](#known-issues--technical-debt)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.1.6 (App Router) |
| UI | React 19, Tailwind CSS 4, Lucide Icons |
| ORM | Prisma 6.19.3 |
| Database | PostgreSQL |
| Auth | JWT (jose) + bcryptjs |
| Maps | Leaflet + React-Leaflet |
| PDF | jsPDF + jspdf-autotable |
| Testing | Vitest 4.1.10 |
| Node.js | v24.19.0 |

---

## Quick Start

```bash
# Install dependencies
npm install

# Setup database
cp .env.example .env   # edit database URL & secrets
npx prisma migrate dev
node prisma/seed.js

# Start dev server
npm run dev
```

### Default Login

| Role | Username | Password | Tenant |
|------|----------|----------|--------|
| Super Admin | `superadmin` | `<SEED_SUPERADMIN_PASSWORD>` | None |
| Admin Operasional | `admin` | `<SEED_ADMIN_PASSWORD>` | Seed tenant |
| Dispatcher | `dispatcher` | `<SEED_ADMIN_PASSWORD>` | Seed tenant |
| Warehouse | `warehouse` | `<SEED_ADMIN_PASSWORD>` | Seed tenant |
| Driver | `driver1` | `<SEED_DRIVER_PASSWORD>` | Seed tenant |

---

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://..."

# Auth
AUTH_SECRET="your-secret-key"
SESSION_HOURS=12

# Rate Limiting
RATE_LOGIN_LIMIT=100
RATE_API_LIMIT=9999
RATE_GPS_LIMIT=9999
MAX_IP_FAILURES=100

# File Upload
MAX_FILE_SIZE_MB=10

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## Architecture Overview

```
src/
├── app/
│   ├── (ops)/           # Main admin panel (requires sidebar auth)
│   ├── (driver)/        # Driver mobile app
│   ├── (customer)/      # Customer portal
│   ├── (public)/        # Public tracking page
│   ├── api/             # REST API routes (100+ endpoints)
│   ├── login/           # Login page
│   └── tracking/        # Public tracking
├── components/          # Shared UI components
├── lib/                 # Utilities, auth, billing, permissions
└── middleware.ts        # Route protection, CSP, feature gating
```

### Key Libraries

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | JWT sign/verify, session management |
| `src/lib/prisma.ts` | Prisma client with tenant-scoping via AsyncLocalStorage |
| `src/lib/permissions.ts` | Permission constants, ROLE_PERMS, `ensureTenantPermissions()` |
| `src/lib/access-scope.ts` | Resolve user access scope from DB |
| `src/lib/api-guard.ts` | `guardPermission()`, `requireAuth()`, rate limiting |
| `src/lib/billing.ts` | Plan definitions, subscription CRUD, usage tracking |
| `src/lib/constants.ts` | Status labels, date formatters |
| `src/lib/eta.ts` | SLA calculations |
| `src/middleware.ts` | Route protection, feature gating, CSP headers |

---

## Multi-Tenant System

### How It Works

1. **Tenant Scoping** — Prisma client uses `AsyncLocalStorage` to automatically filter queries by `tenantId`
2. **Session** — JWT contains `tenantId`; every API request sets the tenant context
3. **Isolation** — Data from tenant A is invisible to tenant B (except Super Admin)
4. **Auto-filtering** — Models marked in `TENANT_SCOPED` (src/lib/prisma.ts) get automatic `WHERE tenantId = ?`

### Tenant Lifecycle

```
ACTIVE → SUSPENDED → ACTIVE (reactivate)
ACTIVE → DEACTIVATED (soft delete)
```

### Tenant Fields

| Field | Description |
|-------|-------------|
| `id` | CUID primary key |
| `name` | Company name |
| `slug` | URL-safe identifier (unique) |
| `code` | Short company code |
| `plan` | FREE / STARTER / GROWTH / PRO / ENTERPRISE |
| `status` | ACTIVE / SUSPENDED |
| `maxStorageMb` | Upload storage limit per plan |
| `primaryColor` | White-label branding |
| `timezone` | Default `Asia/Jakarta` |

---

## RBAC & Permissions

### Roles (9 total)

| Role | Description |
|------|-------------|
| `SUPER_ADMIN` | Full system access, all tenants |
| `ADMIN_OPERASIONAL` | Tenant admin, manages users/drivers/shipments |
| `DISPATCHER` | Assigns drivers, manages delivery flow |
| `WAREHOUSE` | Scans packages, manages warehouse ops |
| `SUPERVISOR` | Views reports, manages driver status |
| `MANAGEMENT` | Read-only analytics & exports |
| `CUSTOMER_SERVICE` | Manages customers, reschedules deliveries |
| `DRIVER` | Views tasks, completes deliveries |
| `CUSTOMER` | Tracks own shipments, reads notifications |

### Permission Groups (25 resources, 80+ permissions)

| Resource | Permissions |
|----------|------------|
| `shipment` | read, create, update, cancel, assign, export |
| `delivery` | read, dispatch, start, complete, fail, reschedule |
| `driver` | read, create, update, delete, assign |
| `vehicle` | read, create, update, delete |
| `customer` | read, create, update, delete |
| `warehouse` | read, create, update, delete, scan, sort |
| `user` | read, create, update, delete |
| `billing` | read, manage |
| `report` | view, export |
| `audit` | read |
| `geofence` | read, create, update, delete |
| `notification` | read, send |
| `organization` | read, create, update, delete |
| `region` | read, create, update, delete |
| `branch` | read, create, update, delete |
| `department` | read, create, update, delete |
| `hub` | read, create, update, delete |
| `settings` | read, update, delete |
| `sla` | read, create, update, delete |
| `exception` | read, create, update, assign |
| `analytics` | view |
| `control_tower` | view |
| `dispatch` | view, assign |
| `gps` | send, read |
| `file` | read, upload |
| `daily_report` | read, create |

### How Permissions Are Resolved

1. User logs in → JWT contains `role` + `tenantId`
2. API route calls `guardPermission(PERMISSIONS.SHIPMENT.READ)`
3. `resolveAccessScope()` queries `RolePermission` table for user's role + tenant
4. Returns list of granted permission codes
5. `hasPermission()` checks if requested permission is in the list
6. `SUPER_ADMIN` always gets `*` (all permissions)

### Permission Seeding

- `ensureTenantPermissions(tenantId)` creates missing `RolePermission` entries
- Called automatically on tenant creation
- Backfilled for all existing tenants

---

## Database Schema

### Core Models (52 total)

| Model | Description |
|-------|-------------|
| `Tenant` | Multi-tenant company |
| `User` | Login accounts with role |
| `Driver` | Driver profiles linked to User |
| `Vehicle` | Fleet vehicles |
| `Customer` | Sender/receiver contacts |
| `Shipment` | Package tracking records |
| `ShipmentItem` | Items within a shipment |
| `ShipmentStop` | Multi-stop delivery routes |
| `DeliveryAssignment` | Driver ↔ Shipment assignments |
| `TrackingEvent` | Status change history |
| `ShipmentEvent` | Detailed event log |
| `ProofOfDelivery` | POD with photo/signature |
| `DailyReport` | Driver daily activity reports |
| `GpsLog` | GPS location pings |
| `Geofence` | Virtual zone boundaries |
| `GeofenceEvent` | Geofence entry/exit events |
| `Branch` | Physical locations |
| `Department` | Organizational units |
| `Hub` | Distribution hubs |
| `Organization` | Company divisions |
| `Region` | Geographic regions |
| `Warehouse` | Warehouse facilities |
| `WarehouseScan` | Scan events at warehouse |
| `Notification` | In-app notifications |
| `AuditLog` | Security audit trail |
| `LoginAttempt` | Brute-force protection |
| `Exception` | Delivery exceptions |
| `SlaPolicy` | SLA rules |
| `SlaEvent` | SLA breach/at-risk events |
| `IntegrationConfig` | Third-party integrations |
| `ApiKey` | API authentication keys |
| `UploadedFile` | File upload records |
| `WebhookSubscription` | Webhook configs |
| `WebhookDelivery` | Webhook delivery log |
| `Message` | Chat/messaging |
| `Plan` | Subscription plans |
| `Subscription` | Active plan per tenant |
| `Invoice` | Billing invoices |
| `Payment` | Payment records |
| `UsageRecord` | Metered usage tracking |
| `PlanAddon` | Add-on products |
| `TenantAddon` | Purchased add-ons |
| `Permission` | Permission definitions |
| `RolePermission` | Role ↔ Permission mapping |
| `WhiteLabel` | White-label customization |
| `TenantOnboarding` | Onboarding progress |
| `TenantHealthMetric` | Health monitoring data |
| `PasswordResetToken` | Password reset tokens |
| `VehicleMaintenance` | Maintenance records |
| `DemoRequest` | Demo request forms |

### Key Enums

```prisma
enum Role { SUPER_ADMIN, ADMIN_OPERASIONAL, DISPATCHER, WAREHOUSE, DRIVER, CUSTOMER_SERVICE, SUPERVISOR, MANAGEMENT, CUSTOMER }
enum ShipmentStatus { ORDER_CREATED, PICKUP_SCHEDULED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, DELIVERY_FAILED, RETURNED, RETURN_TO_SENDER, CANCELLED }
enum ServiceType { REGULAR, EXPRESS, SAME_DAY, FREIGHT }
enum DriverStatus { ACTIVE, INACTIVE }
enum UserStatus { ACTIVE, INACTIVE }
```

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with username + tenantId |
| POST | `/api/auth/logout` | Clear session |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/change-password` | Change password |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset with token |
| GET | `/api/auth/tenants` | List tenants for login |

### Core Resources

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/drivers` | List/create drivers |
| GET/PATCH/DELETE | `/api/drivers/[id]` | Read/update/delete driver |
| GET/POST | `/api/vehicles` | List/create vehicles |
| GET/PATCH/DELETE | `/api/vehicles/[id]` | Read/update/delete vehicle |
| GET/POST | `/api/customers` | List/create customers |
| GET/PATCH/DELETE | `/api/customers/[id]` | Read/update/delete customer |
| GET/POST | `/api/shipments` | List/create shipments |
| GET/PATCH/DELETE | `/api/shipments/[id]` | Read/update/delete shipment |
| POST | `/api/shipments/[id]/assign` | Assign driver to shipment |
| GET | `/api/shipments/[id]/events` | Shipment event history |
| POST | `/api/shipments/[id]/pod` | Submit proof of delivery |

### Organizational

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/organizations` | List/create organizations |
| GET/POST | `/api/regions` | List/create regions |
| GET/POST | `/api/branches` | List/create branches |
| GET/POST | `/api/departments` | List/create departments |
| GET/POST | `/api/hubs` | List/create hubs |
| GET/POST | `/api/warehouses` | List/create warehouses |
| GET | `/api/hierarchy/overview` | Full hierarchy tree |

### Driver App

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/driver/tasks` | Get assigned shipments |
| POST | `/api/driver/tasks/[id]` | Start/arrive/POD/fail delivery |
| GET/POST | `/api/driver/daily-report` | Get/submit daily reports |
| GET | `/api/driver/status` | Current driver status |
| POST | `/api/driver/sync` | Sync driver data |

### GPS & Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/gps` | Get/send GPS data |
| GET | `/api/gps/latest` | Latest GPS per driver |
| GET | `/api/gps/global` | Global GPS overview |
| GET | `/api/tracking/[resi]` | Public shipment tracking |

### Billing

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/billing` | Plans, subscription, usage |
| POST | `/api/billing` | Subscribe to plan |
| POST | `/api/billing/cancel` | Cancel subscription |
| GET/POST | `/api/billing/addons` | List/purchase add-ons |
| GET | `/api/billing/invoices` | List invoices |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/tenants` | List/create tenants |
| GET/PATCH/DELETE | `/api/tenants/[id]` | Manage tenant |
| GET | `/api/tenants/[id]/health` | Tenant health metrics |
| PUT | `/api/admin/roles` | Update role permissions |
| GET | `/api/admin/security` | Security dashboard |
| GET | `/api/audit` | Audit log entries |
| GET/POST | `/api/users` | List/create users |
| GET/POST | `/api/notifications` | List/send notifications |

---

## Frontend Pages

### Admin Panel (`/dashboard`, etc.)

| Path | Page | Role |
|------|------|------|
| `/dashboard` | Analytics dashboard | All ops roles |
| `/tenants` | Tenant management | SUPER_ADMIN |
| `/users` | User management | ADMIN_OPERASIONAL+ |
| `/drivers` | Driver management | ADMIN_OPERASIONAL+ |
| `/vehicles` | Vehicle fleet | ADMIN_OPERASIONAL+ |
| `/customers` | Customer database | ADMIN_OPERASIONAL+ |
| `/shipments` | Shipment tracking | ADMIN_OPERASIONAL+ |
| `/dispatch` | Dispatch board | DISPATCHER+ |
| `/branches` | Branch management | ADMIN_OPERASIONAL+ |
| `/departments` | Department management | ADMIN_OPERASIONAL+ |
| `/hubs` | Hub management | ADMIN_OPERASIONAL+ |
| `/organizations` | Organization management | ADMIN_OPERASIONAL+ |
| `/regions` | Region management | ADMIN_OPERASIONAL+ |
| `/warehouse` | Warehouse scan | WAREHOUSE |
| `/warehouses` | Warehouse management | ADMIN_OPERASIONAL+ |
| `/roles` | Roles & permissions | ADMIN_OPERASIONAL+ |
| `/billing` | Billing & subscriptions | ADMIN_OPERASIONAL+ |
| `/reports` | Reports & analytics | SUPERVISOR+ |
| `/audit` | Audit log | SUPER_ADMIN |
| `/security` | Security dashboard | SUPER_ADMIN |
| `/geofences` | Geofence management | ADMIN_OPERASIONAL+ |
| `/hierarchy` | Hierarchy overview | SUPER_ADMIN |
| `/map` | Live GPS map | ADMIN_OPERASIONAL+ |
| `/control-tower` | Control tower | DISPATCHER+ |
| `/settings` | App settings | ADMIN_OPERASIONAL+ |
| `/integrations` | Third-party integrations | ADMIN_OPERASIONAL+ |

### Driver App (`/driver`)

| Path | Page |
|------|------|
| `/driver` | Task list & daily reports |
| `/driver/tasks/[id]` | Task detail & POD submission |
| `/driver/laporan` | Report history |

### Customer Portal (`/customer`)

| Path | Page |
|------|------|
| `/customer` | Customer dashboard |
| `/customer/shipments` | My shipments |

### Public

| Path | Page |
|------|------|
| `/` | Landing page |
| `/login` | Login page |
| `/tracking` | Public shipment tracking |
| `/tracking/[resi]` | Track by resi number |

---

## Authentication Flow

### Login

```
1. User enters username + selects tenant
2. POST /api/auth/login → validates credentials
3. JWT signed with AUTH_SECRET → contains id, role, tenantId, plan
4. Set cookie: dtms_token (HttpOnly, SameSite=Lax)
5. Redirect based on role:
   - SUPER_ADMIN → /tenants
   - DRIVER → /driver
   - Others → /dashboard
```

### Session Management

- JWT expiry: configurable via `SESSION_HOURS` (default 12h)
- Contains: user id, name, username, role, tenantId, branchId, plan, planFeatures
- Plan features are baked into JWT — re-login needed after plan change

### Security Features

- **Brute-force protection**: Exponential backoff via `LoginAttempt` table
- **CSRF**: `dtms_csrf` cookie + `x-csrf-token` header
- **Rate limiting**: Per-IP login limits, per-tenant API limits
- **Password validation**: Min length, complexity requirements
- **Audit logging**: All mutations logged to `AuditLog`
- **2FA**: TOTP-based two-factor authentication

---

## Billing & Subscriptions

### 5-Tier Plan System

| Plan | Price | Max Users | Max Drivers | Max Shipments | Storage |
|------|-------|-----------|-------------|---------------|---------|
| FREE | Rp 0 | 3 | 5 | 50 | 50 MB |
| STARTER | Rp 99K/bulan | 10 | 25 | 500 | 500 MB |
| GROWTH | Rp 299K/bulan | 25 | 50 | 2,000 | 2 GB |
| PRO | Rp 599K/bulan | 50 | 100 | 5,000 | 5 GB |
| ENTERPRISE | Rp 1.2M/bulan | Unlimited | Unlimited | Unlimited | 20 GB |

### Plan Limits Enforcement

- `guardPlanLimit(session, resource)` checks usage vs plan limits
- Applied to: users, drivers, shipments, branches, hubs, organizations
- Storage limit checked on file upload
- API rate limits enforced per-plan

### Subscription Lifecycle

```
Free → Subscribe(STARTER) → Active (trial period)
Active → Cancel → Ends at period end
Active → Upgrade(GROWTH) → Immediate proration
Cancelled → Resubscribe → New trial (no repeat)
```

---

## GPS Tracking

### How It Works

1. **Driver app** sends GPS pings via `POST /api/gps`
2. **GpsSender component** polls browser geolocation every 15 seconds
3. **GpsLog table** stores all pings with lat/lng/speed/battery/timestamp
4. **Live map** (`/map`) shows real-time driver positions via Leaflet
5. **Geofences** trigger events when drivers enter/exit zones

### GPS Data Model

```typescript
{
  driverId: string,
  vehicleId: string,
  latitude: number,
  longitude: number,
  speed: number | null,
  battery: number | null,
  heading: number | null,
  accuracy: number | null,
}
```

### Geofencing

- Virtual zones defined with coordinates + radius
- Automatic entry/exit detection from GPS pings
- Used for: warehouse check-in, delivery zone validation
- Events stored in `GeofenceEvent` table

---

## Driver Mobile App

### Structure

```
/driver               → Task list + daily reports
/driver/tasks/[id]    → Task detail + POD submission
/driver/laporan       → Report history
```

### Features

- **Task List**: Active & completed shipments assigned to driver
- **Status Updates**: Start (IN_TRANSIT) → Arrive (OUT_FOR_DELIVERY) → POD (DELIVERED) / Fail
- **Proof of Delivery**: Photo upload + recipient name + notes
- **Daily Reports**: Delivered count, failed count, fuel usage, notes
- **GPS Tracking**: Automatic background location sharing
- **Status Card**: Vehicle info, GPS status, active shipment overview

### Driver Account Creation

1. Admin creates driver via `/drivers` page
2. Optional: fill username + password to create login account
3. User record created with `role: DRIVER`, `tenantId` from session
4. Driver logs in at `/login` → selects tenant → enters credentials
5. Redirected to `/driver` (standalone mobile-optimized layout)

---

## Known Issues & Technical Debt

### Architecture

| Issue | Severity | Description |
|-------|----------|-------------|
| JWT stale plan | Medium | Plan features baked into JWT; plan changes require re-login |
| In-memory rate limiting | Low | Rate limit buckets are per-instance; broken behind load balancers |
| Middleware imports | High | `middleware.ts` imports from `billing.ts` which uses Node.js modules (Edge incompatibility) |

### Multi-Tenant

| Issue | Severity | Description |
|-------|----------|-------------|
| NULL tenantId bypass | Medium | Records with `tenantId: null` are accessible from all tenants |
| `employeeId` global uniqueness | Low | Driver/Vehicle IDs are globally unique; cross-tenant collision possible |

### API

| Issue | Severity | Description |
|-------|----------|-------------|
| Catch-all error masking | Medium | Some PATCH/DELETE routes catch all errors and return generic messages |
| N+1 queries | Low | Some list endpoints include related data without batching |

### Frontend

| Issue | Severity | Description |
|-------|----------|-------------|
| Search race conditions | Medium | Debounced searches lack AbortController; stale results can overwrite |
| Modal hydration mismatch | Low | `Math.random()` in useRef differs between SSR and client |

### Git History

- Commit `787daff` — Billing UI rewrite (5 tiers, trial banner, addons)
- Commit `32f2f3b` — Logout redirects to landing page
- Commit `a701116` — Unified hierarchy dashboard
- Commit `0ef8bb0` — Permissions seeded for all tenants
- Commit `6fc1c6f` — Comprehensive bug audit (12 fixes)

---

## Scripts

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run start            # Start production server
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations (dev)
npm run db:deploy        # Run migrations (production)
npm run db:seed          # Seed database
npm run db:reset         # Reset + reseed database
npm run test             # Run all tests
npm run test:watch       # Run tests in watch mode
npm run lint             # Run ESLint
npm run lint:fix         # Auto-fix lint issues
npm run typecheck        # TypeScript type checking
npm run alerts:run       # Run alert scheduler once
npm run alerts:scheduler # Run alert scheduler continuously
```

---

## Folder Structure

```
src/
├── app/
│   ├── (ops)/                    # Admin panel route group
│   │   ├── analytics/            # Analytics dashboard
│   │   ├── audit/                # Audit log viewer
│   │   ├── billing/              # Billing & subscription management
│   │   ├── branches/             # Branch management
│   │   ├── control-tower/        # Operational control tower
│   │   ├── customers/            # Customer database
│   │   ├── dashboard/            # Main dashboard with KPIs
│   │   ├── demo-requests/        # Demo request management
│   │   ├── departments/          # Department management
│   │   ├── dispatch/             # Dispatch board
│   │   ├── drivers/              # Driver management
│   │   ├── exceptions/           # Delivery exceptions
│   │   ├── geofences/            # Geofence management
│   │   ├── global-control-tower/ # Cross-tenant control tower
│   │   ├── hierarchy/            # Org/region/branch/dept overview
│   │   ├── hubs/                 # Hub management
│   │   ├── integrations/         # Third-party integrations
│   │   ├── map/                  # Live GPS map
│   │   ├── notifications/        # Notification center
│   │   ├── organizations/        # Organization management
│   │   ├── regions/              # Region management
│   │   ├── reports/              # Reports & exports
│   │   ├── roles/                # Roles & permissions editor
│   │   ├── security/             # Security dashboard
│   │   ├── settings/             # App settings
│   │   ├── shipments/            # Shipment management
│   │   ├── sla/                  # SLA policy management
│   │   ├── tenant-health/        # Tenant health monitoring
│   │   ├── tenant-onboarding/    # Onboarding wizard
│   │   ├── tenants/              # Tenant management
│   │   ├── users/                # User management
│   │   ├── vehicles/             # Vehicle fleet
│   │   └── warehouse/            # Warehouse scan interface
│   ├── (driver)/                 # Driver mobile app route group
│   │   └── driver/
│   │       ├── tasks/[id]/       # Task detail + POD
│   │       └── laporan/          # Report history
│   ├── (customer)/               # Customer portal route group
│   ├── (public)/                 # Public pages
│   ├── api/                      # 100+ API routes
│   └── login/                    # Login page
├── components/                   # Shared React components
│   ├── DriverStatusCard.tsx      # Driver status widget
│   ├── DriverLiveMap.tsx         # Live GPS map for driver
│   ├── Header.tsx                # App header with user menu
│   ├── LogoutButton.tsx          # Logout component
│   ├── Pagination.tsx            # Pagination component
│   ├── PhoneInput.tsx            # International phone input
│   ├── PhotoField.tsx            # Photo upload component
│   ├── LocationPicker.tsx        # Leaflet map picker
│   ├── Sidebar.tsx               # Navigation sidebar
│   ├── StatCard.tsx              # Stats display card
│   ├── StatusBadge.tsx           # Status badge component
│   └── ui.tsx                    # Modal, Field, buttons, etc.
└── lib/
    ├── access-scope.ts           # User access scope resolution
    ├── api-guard.ts              # Auth & permission guards
    ├── auth.ts                   # JWT & session management
    ├── billing.ts                # Plan definitions & billing logic
    ├── constants.ts              # Status labels, formatters
    ├── eta.ts                    # SLA calculations
    ├── permissions.ts            # Permission constants & seeding
    └── prisma.ts                 # Prisma client with tenant scoping
```

