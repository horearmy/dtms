# DTMS — Dokumentasi Sistem Lengkap

> Delivery Tracking Management System
> Versi: 2.0.0 | Terakhir diperbarui: Agustus 2026

---

## Daftar Isi

1. [Gambaran Umum](#1-gambaran-umum)
2. [Arsitektur & Tech Stack](#2-arsitektur--tech-stack)
3. [Struktur Proyek](#3-struktur-proyek)
4. [Database & Schema](#4-database--schema)
5. [Autentikasi & Otorisasi](#5-autentikasi--otorisasi)
6. [Isolasi Data Multi-Tenant](#6-isolasi-data-multi-tenant)
7. [Modul-modul Aplikasi](#7-modul-modul-aplikasi)
8. [API Reference](#8-api-reference)
9. [Middleware & Keamanan](#9-middleware--keamanan)
10. [Library & Utilitas](#10-library--utilitas)
11. [Billing & Subscription](#11-billing--subscription)
12. [Integrasi Eksternal](#12-integrasi-eksternal)
13. [Frontend & Halaman](#13-frontend--halaman)
14. [Pengujian (Testing)](#14-pengujian-testing)
15. & [Script & Maintenance](#15-script--maintenance)
16. [Konfigurasi & Environment](#16-konfigurasi--environment)
17. [Keamanan (OWASP Top 10)](#17-keamanan-owasp-top-10)
18. [Deployment & Operasional](#18-deployment--operasional)
19. [Stress Testing & Performance](#19-stress-testing--performance)
20. [Changelog & Git History](#20-changelog--git-history)

---

## 1. Gambaran Umum

DTMS adalah sistem manajemen dan pelacakan pengiriman berbasis web (responsive) untuk operasional logistik. Dirancang sebagai platform **multi-tenant B2B** yang dapat melayani banyak perusahaan (tenant) dalam satu deployment.

### Fitur Utama

| Kategori | Fitur |
|----------|-------|
| **Autentikasi** | JWT cookie, TOTP 2FA, Google SSO, backup codes, brute-force protection |
| **Multi-Tenant** | Isolasi data otomatis via Prisma middleware, 9 level RBAC, permission granular |
| **Shipment** | CRUD lengkap, tracking number otomatis `DTMS-YYYYMMDD-XXXXXX`, 14 status, multi-stop, SLA |
| **Driver** | Penugasan, GPS real-time, scoring kinerja, laporan harian, return-to-base |
| **Kendaraan** | CRUD, foto 4 sisi, maintenance tracking, jarak tempuh |
| **Live Tracking** | Peta Leaflet/OpenStreetMap, GPS real-time, geofence, heatmap |
| **Control Tower** | KPI dashboard, alerts, resource monitoring |
| **Warehouse** | Scan gudang, sort, dispatch |
| **POD** | Tanda tangan digital, foto, koordinat GPS |
| **SLA** | Deadline otomatis per service type, monitoring on-time/at-risk/breached |
| **Geofencing** | Perimeter area (gudang/hub/operasional), auto alert enter/exit |
| **ETA** | Estimasi kedatangan dinamis (haversine + model kecepatan waktu) |
| **Billing** | 4 tier plan (FREE/STARTER/PRO/ENTERPRISE), invoice, usage tracking |
| **Integrasi** | WhatsApp Business API, webhook, API keys, CSV import/export |
| **Keamanan** | OWASP Top 10 compliant, CSRF, rate limiting, audit logging, SSRF protection |
| **Notifikasi** | In-app, WhatsApp, SSE real-time |
| **Analytics** | Tren 7 hari, driver scoring, vehicle telemetry, export CSV |

### Akun Demo

| Role | Username | Password |
|------|----------|----------|
| Super Admin | `superadmin` | `admin123` |
| Admin Operasional | `admin` | `admin123` |
| Dispatcher | `dispatcher` | `admin123` |
| Warehouse | `warehouse` | `admin123` |
| Customer Service | `cs` | `admin123` |
| Supervisor | `supervisor` | `admin123` |
| Management | `management` | `admin123` |
| Driver 1 | `driver1` | `driver123` |
| Driver 2 | `driver2` | `driver123` |

---

## 2. Arsitektur & Tech Stack

### Arsitektur High-Level

```
┌──────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                           │
│   Next.js 15 App Router · React 19 · Tailwind CSS v4 · Leaflet     │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ HTTP / SSE
┌───────────────────────────────▼──────────────────────────────────────┐
│                        NEXT.JS MIDDLEWARE                            │
│   JWT Auth · CSRF · Rate Limiting · Role Routing · Security Headers │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│                     API ROUTE HANDLERS (83+)                         │
│   Auth · Shipments · Drivers · Vehicles · GPS · Tenants · Billing   │
│   Control Tower · Dispatch · Analytics · Exceptions · SLA · etc.    │
└──────┬────────────────────────┬─────────────────────┬───────────────┘
       │                        │                     │
┌──────▼──────┐  ┌──────────────▼──────┐  ┌──────────▼──────────┐
│   PRISMA    │  │    LIB UTILITIES    │  │   EXTERNAL SERVICES │
│  Middleware │  │   auth, security,   │  │  WhatsApp, Google   │
│  (tenant    │  │   billing, logger,  │  │  OAuth, Sentry,     │
│   scoping)  │  │   geofence, ETA,    │  │  Upstash Redis      │
│             │  │   scoring, alerts   │  │  AWS S3 / MinIO     │
└──────┬──────┘  └─────────────────────┘  └─────────────────────┘
       │
┌──────▼──────────────────────────────────────────────────────────────┐
│                      PostgreSQL 18                                  │
│              33 models · Multi-tenant · UUID primary keys          │
└─────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Teknologi | Versi |
|-------|-----------|-------|
| **Framework** | Next.js (App Router) | 15.1.6 |
| **UI** | React | 19.0.0 |
| **Styling** | Tailwind CSS | v4.0 |
| **Component** | shadcn/ui, lucide-react, cmdk | - |
| **ORM** | Prisma | 6.19.3 |
| **Database** | PostgreSQL | 18 |
| **Auth** | jose (JWT), bcryptjs | 5.9.6, 2.4.3 |
| **Maps** | Leaflet, react-leaflet, leaflet.heat | 1.9.4 |
| **Storage** | AWS SDK S3 / Local FS | 3.1112.0 |
| **Cache** | Upstash Redis | 1.38.2 |
| **Monitoring** | Sentry | 10.70.0 |
| **2FA** | Custom TOTP (HMAC-SHA1) | - |
| **Language** | TypeScript | 5.7.3 |
| **Testing** | Vitest | 4.1.10 |
| **Linting** | ESLint | 9.39.5 |

### Persyaratan

- **Node.js** ≥ 20 (dikembangkan dengan v24)
- **PostgreSQL** ≥ 14 (dikembangkan dengan v18)
- **Git** (opsional)

---

## 3. Struktur Proyek

```
DTMS/
├── .env                    # Environment variables (gitignored)
├── .env.example            # Template environment
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.mjs         # Next.js config (Sentry, strict mode)
├── vitest.config.ts        # Test config (globalSetup, path aliases)
├── vercel.json             # Vercel cron config
├── components.json         # shadcn config
├── postcss.config.mjs
├── eslint.config.mjs
├── sentry.client.config.ts
├── sentry.server.config.ts
├── sentry.edge.config.ts
│
├── prisma/
│   ├── schema.prisma       # Database schema (33 models, 11 enums)
│   ├── seed.js             # Data contoh (default accounts + sample data)
│   └── migrations/         # Migration history
│
├── scripts/                # Utility & maintenance scripts (24 files)
│   ├── bulk-seed.ts        # Bulk data seeding (10K tenants, 10M records)
│   ├── burst-drivers.ts    # GPS burst testing
│   ├── clear-attempts.ts   # Clear login attempts
│   ├── perf-stress.ts      # Performance stress testing
│   ├── alert-scheduler.js  # SLA & GPS alert daemon
│   └── ...
│
├── public/                 # Static assets
├── storage/                # Local file uploads
├── docs/                   # Documentation
│   ├── SISTEM_LENGKAP.md   # ← This file
│   ├── FLOW.md             # Application flows
│   ├── MULTI_TENANT_ISOLATION.md
│   └── DTMS_Enterprise_Upgrade_Blueprint.md
│
├── .github/                # GitHub Actions
│
└── src/
    ├── middleware.ts        # Next.js middleware (auth, CSRF, rate limit, headers)
    │
    ├── app/                # Next.js App Router
    │   ├── (ops)/          # Operations dashboard pages
    │   │   ├── dashboard/
    │   │   ├── shipments/
    │   │   ├── drivers/
    │   │   ├── vehicles/
    │   │   ├── customers/
    │   │   ├── dispatch/
    │   │   ├── map/
    │   │   ├── reports/
    │   │   ├── analytics/
    │   │   ├── control-tower/
    │   │   ├── geofences/
    │   │   ├── sla/
    │   │   ├── exceptions/
    │   │   ├── users/
    │   │   ├── tenants/
    │   │   ├── billing/
    │   │   ├── integrations/
    │   │   ├── audit/
    │   │   ├── notifications/
    │   │   ├── messages/
    │   │   ├── warehouse/scan/
    │   │   └── settings/whatsapp/
    │   │
    │   ├── (driver)/       # Driver mobile app pages
    │   │   ├── driver/
    │   │   ├── driver/tasks/[assignmentId]/
    │   │   └── driver/laporan/
    │   │
    │   ├── (customer)/     # Customer portal pages
    │   │   ├── customer/
    │   │   └── customer/shipments/
    │   │
    │   ├── (public)/       # Public pages
    │   │   ├── tracking/
    │   │   └── tracking/[resi]/
    │   │
    │   ├── login/
    │   ├── forgot-password/
    │   ├── reset-password/
    │   ├── account/password/
    │   ├── account/security/
    │   ├── index.tsx        # Landing page
    │   │
    │   └── api/             # 83+ API route files
    │       ├── auth/
    │       ├── shipments/
    │       ├── drivers/
    │       ├── vehicles/
    │       ├── customers/
    │       ├── gps/
    │       ├── tracking/
    │       ├── tenants/
    │       ├── users/
    │       ├── control-tower/
    │       ├── dispatch/
    │       ├── analytics/
    │       ├── exceptions/
    │       ├── sla-policies/
    │       ├── sla-events/
    │       ├── geofences/
    │       ├── billing/
    │       ├── integrations/
    │       ├── webhooks/
    │       ├── api-keys/
    │       ├── notifications/
    │       ├── messages/
    │       ├── files/
    │       ├── upload/
    │       ├── whatsapp/
    │       ├── events/
    │       ├── health/
    │       ├── metrics/
    │       ├── audit/
    │       ├── admin/
    │       └── ...
    │
    ├── components/         # React components (UI, map, signature, etc.)
    ├── hooks/              # Custom React hooks
    ├── lib/                # 32 utility/service modules
    │   ├── auth.ts         # JWT sign/verify, session management
    │   ├── prisma.ts       # Prisma client, tenant scoping middleware
    │   ├── security.ts     # Brute-force, rate limit, password validation
    │   ├── api-guard.ts    # RBAC guards, permission checks, audit logging
    │   ├── permissions.ts  # 44 permission definitions
    │   ├── access-scope.ts # Role → permission resolution
    │   ├── billing.ts      # Plans, subscriptions, invoices
    │   ├── constants.ts    # Status labels, colors, SLA hours, city coords
    │   ├── logger.ts       # Structured JSON logger
    │   ├── totp.ts         # TOTP 2FA implementation
    │   ├── totp-encrypt.ts # AES-256-GCM TOTP secret encryption
    │   ├── storage.ts      # File upload (S3/Local)
    │   ├── whatsapp.ts     # WhatsApp Business API
    │   ├── eta-engine.ts   # ETA calculation (Haversine)
    │   ├── geofence.ts     # Geofence enter/exit detection
    │   ├── scoring.ts      # Driver performance scoring
    │   ├── alerts.ts       # SLA & GPS alert scanning
    │   ├── provisioning.ts # Tenant auto-provisioning
    │   ├── tenant.ts       # Tenant resolution (domain/subdomain)
    │   ├── csrf.ts         # Client-side CSRF helpers
    │   ├── integration-hub.ts  # OAuth, CSV import/export, API keys
    │   ├── job-queue.ts    # In-memory job queue
    │   ├── metrics.ts      # Prometheus-compatible metrics
    │   ├── sla.ts          # SLA deadline & status evaluation
    │   ├── sse-bus.ts      # Server-Sent Events pub/sub
    │   ├── gps-processor.ts    # Async GPS pipeline
    │   ├── gps.ts          # Client-side geolocation
    │   ├── mapTiles.ts     # Map tile provider
    │   ├── landing-data.ts # Marketing page data
    │   └── utils.ts        # cn() class merge utility
    │
    ├── types/              # TypeScript type definitions
    │
    └── integration/        # Integration test infrastructure
        ├── global-setup.ts # Global test setup (login, cache tokens)
        ├── helpers.ts      # Test helpers (getAuth, api, login)
        └── __tests__/      # 10 test files, 191 test cases
```

---

## 4. Database & Schema

### Ringkasan

- **Engine**: PostgreSQL 18
- **ORM**: Prisma 6.19.3
- **Total Models**: 33
- **Total Enums**: 11
- **Primary Key**: UUID (auto-generated)

### Enums

| Enum | Nilai |
|------|-------|
| `TenantStatus` | PROSPECT, PENDING_APPROVAL, ONBOARDING, UAT, ACTIVE, SUSPENDED, GRACE_PERIOD, OFFBOARDING, ARCHIVED |
| `Role` | SUPER_ADMIN, ADMIN_OPERASIONAL, DISPATCHER, WAREHOUSE, DRIVER, CUSTOMER_SERVICE, SUPERVISOR, MANAGEMENT, CUSTOMER |
| `UserStatus` | ACTIVE, INACTIVE |
| `DriverStatus` | ACTIVE, INACTIVE |
| `ShipmentStatus` | ORDER_CREATED, PICKUP_SCHEDULED, PICKED_UP, WAREHOUSE_RECEIVED, SORTING, DISPATCHED, IN_TRANSIT, ARRIVED_AT_HUB, OUT_FOR_DELIVERY, DELIVERED, DELIVERY_FAILED, RESCHEDULED, RETURN_TO_SENDER, RETURNED |
| `ShipmentEventType` | SHIPMENT_CREATED, WAREHOUSE_RECEIVED, SORTED, ASSIGNED, DISPATCHED, GPS_STARTED, ARRIVED_HUB, OUT_FOR_DELIVERY, DELIVERED, POD_SUBMITTED, POD_VERIFIED, COMPLETED, DELIVERY_FAILED, RESCHEDULED, RETURNED, CANCELLED, STATUS_UPDATED |
| `ExceptionStatus` | OPEN, ASSIGNED, INVESTIGATING, ACTION_REQUIRED, RESOLVED, VERIFIED, CLOSED, CANCELLED |
| `ExceptionSeverity` | LOW, MEDIUM, HIGH, CRITICAL |
| `ExceptionType` | DELIVERY_FAILED, ADDRESS_UNREACHABLE, CUSTOMER_UNAVAILABLE, DAMAGED_GOODS, LOST_PACKAGE, SLA_BREACH, VEHICLE_BREAKDOWN, DRIVER_ISSUE, ROUTE_DEVIATION, WEATHER, OTHER |
| `ServiceType` | SAME_DAY, NEXT_DAY, REGULAR |
| `GeofenceType` | WAREHOUSE, HUB, OPERATIONAL_AREA, DESTINATION |
| `GeofenceEventType` | ENTER, EXIT |
| `IntegrationType` | REST_API, WEBHOOK, SFTP, CSV, EDI |

### Model Database

#### Core Business

| Model | Keterangan | Relasi Utama |
|-------|------------|--------------|
| **Tenant** | Perusahaan/root entity | → Users, Customers, Shipments, Drivers, Vehicles, Geofences |
| **Shipment** | Entitas pengiriman inti | → Sender/Receiver (Customer), Items, Stops, Events, Assignments, POD |
| **ShipmentItem** | Item dalam shipment | → Shipment |
| **ShipmentStop** | Titik transit multi-stop | → Shipment, Customer |
| **TrackingEvent** | Riwayat status shipment | → Shipment |
| **ShipmentEvent** | Event detail perubahan status | → Shipment, Tenant |
| **DeliveryAssignment** | Penugasan driver+kendaraan | → Shipment, Driver, Vehicle |
| **ProofOfDelivery** | Bukti penerimaan (tanda tangan, foto) | → Shipment |

#### Master Data

| Model | Keterangan | Relasi Utama |
|-------|------------|--------------|
| **User** | Pengguna sistem | → Tenant, Branch, Driver |
| **Driver** | Data kurir | → Tenant, User, Assignments, GPS Logs, DailyReports |
| **Vehicle** | Data kendaraan | → Tenant, Assignments, GPS Logs, Maintenance |
| **Customer** | Pelanggan (pengirim/penerima) | → Tenant, Shipments (sent/received) |
| **Company** | Perusahaan within tenant | → Tenant, Branches, Departments |
| **Branch** | Cabang | → Tenant, Company, Warehouses, Hubs |
| **Department** | Departemen | → Company |
| **Warehouse** | Gudang | → Tenant, Branch |
| **Hub** | Hub distribusi | → Tenant, Branch |
| **Geofence** | Perimeter area | → Tenant, Events |

#### Operasional

| Model | Keterangan | Relasi Utama |
|-------|------------|--------------|
| **GpsLog** | Catatan posisi GPS | → Driver, Vehicle |
| **GeofenceEvent** | Event masuk/keluar geofence | → Geofence, Driver |
| **DailyReport** | Laporan harian driver | → Driver |
| **VehicleMaintenance** | Record perawatan kendaraan | → Vehicle |
| **WarehouseScan** | Scan gudang | → Shipment |
| **Notification** | Notifikasi in-app | → User, Shipment |
| **AuditLog** | Jejak audit | → User |
| **Exception** | Insiden/pengecualian | → Tenant, Shipment |

#### SLA

| Model | Keterangan |
|-------|------------|
| **SlaPolicy** | Aturan SLA per service type |
| **SlaEvent** | Status SLA per shipment |

#### Billing & Subscription

| Model | Keterangan |
|-------|------------|
| **Plan** | Paket langganan (FREE/STARTER/PRO/ENTERPRISE) |
| **Subscription** | Langganan tenant |
| **Invoice** | Tagihan |
| **Payment** | Pembayaran |
| **UsageRecord** | Catatan penggunaan |

#### Platform

| Model | Keterangan |
|-------|------------|
| **RolePermission** | Mapping role → permission per tenant |
| **Permission** | Definisi 44 permission |
| **LoginAttempt** | Tracking percobaan login (brute-force) |
| **PasswordResetToken** | Token reset password |
| **DemoRequest** | Permintaan demo |
| **IntegrationConfig** | Konfigurasi integrasi pihak ketiga |
| **ApiKey** | Kunci API |
| **WebhookSubscription** | Endpoint webhook |
| **WebhookDelivery** | Log pengiriman webhook |
| **IntegrationLog** | Log request integrasi |
| **UploadedFile** | File yang diunggah |
| **Message** | Pesan tenant ↔ super admin |
| **TenantRateLimit** | Rate limit per tenant |

### ER Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    Tenant    │──────<│     User     │──────<│    Driver    │
│              │       │              │       │              │
│ id (UUID)    │       │ id (UUID)    │       │ id (UUID)    │
│ name         │       │ tenantId     │       │ tenantId     │
│ slug (uniq)  │       │ name         │       │ employeeId   │
│ plan         │       │ role         │       │ name         │
│ active       │       │ status       │       │ status       │
└──────┬───────┘       └──────────────┘       └──────┬───────┘
       │                                             │
       │         ┌──────────────┐                    │
       ├────────<│   Customer   │         ┌──────────┴─────────┐
       │         │              │         │   DeliveryAssignment│
       │         │ id (UUID)    │         │                     │
       │         │ tenantId     │         │ shipmentId          │
       │         │ name         │         │ driverId            │
       │         │ phone        │         │ vehicleId           │
       │         └──────────────┘         └──────────┬─────────┘
       │                                             │
       │         ┌──────────────┐                    │
       ├────────<│   Shipment   │────────>───────────┘
       │         │              │
       │         │ id (UUID)    │    ┌──────────────┐
       │         │ tenantId     │───<│ ShipmentItem  │
       │         │ trackingNum  │    └──────────────┘
       │         │ status       │    ┌──────────────┐
       │         │ serviceType  │───<│ ShipmentStop  │
       │         │ senderId     │    └──────────────┘
       │         │ receiverId   │    ┌──────────────┐
       │         └──────────────┘───<│TrackingEvent  │
       │                            └──────────────┘
       │         ┌──────────────┐    ┌──────────────┐
       ├────────<│   Vehicle    │    │   GpsLog     │
       │         │              │───<│ driverId     │
       │         │ id (UUID)    │    │ vehicleId    │
       │         │ tenantId     │    │ lat, lng     │
       │         │ vehicleNumber│    └──────────────┘
       │         └──────────────┘
       │
       │         ┌──────────────┐    ┌──────────────┐
       ├────────<│   Geofence   │───<│GeofenceEvent │
       │         │              │    │ geofenceId   │
       │         │ id (UUID)    │    │ driverId     │
       │         │ tenantId     │    │ eventType    │
       │         │ name         │    └──────────────┘
       │         │ lat, lng     │
       │         │ radiusMeters │
       │         └──────────────┘
       │
       │         ┌──────────────┐    ┌──────────────┐
       ├────────<│    Plan      │───<│ Subscription │
       │         │              │    │              │
       │         │ id (UUID)    │    │ tenantId     │
       │         │ code         │    │ planId       │
       │         │ priceMonthly │    │ status       │
       │         └──────────────┘    └──────┬───────┘
       │                                    │
       │                              ┌─────┴──────┐
       │                              │  Invoice   │
       │                              │            │
       │                              │ tenantId   │
       │                              │ subscriptionId│
       │                              └────────────┘
       │
       └────────< (27 tenant-scoped models total)
```

---

## 5. Autentikasi & Otorisasi

### 5.1 Login Flow

```
┌─────────────────────────────────────────────────────────┐
│                      LOGIN FLOW                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. User pilih tenant + input username/password         │
│                    ↓                                    │
│  2. Rate limit check (IP-based, 10/min default)        │
│                    ↓                                    │
│  3. Brute-force check (per-username + per-IP)           │
│     - MAX_USER_FAILURES = 5                             │
│     - MAX_IP_FAILURES = 20                              │
│     - Exponential backoff setelah 3 kegagalan           │
│                    ↓                                    │
│  4. Validate: tenant.active = true                      │
│               user.status = ACTIVE                      │
│                    ↓                                    │
│  5. bcrypt.compare(password, hash)                      │
│                    ↓                                    │
│  6. Check 2FA (totpEnabled?)                            │
│     ├─ Yes → Return twoFactorToken (JWT 5 menit)       │
│     │        User input OTP → POST /api/auth/two-factor │
│     │                    ↓                              │
│     └─ No  → Continue                                  │
│                    ↓                                    │
│  7. Check mustChangePassword → redirect ke /account/pw  │
│                    ↓                                    │
│  8. Generate JWT (HS256, 12 jam expiry)                 │
│                    ↓                                    │
│  9. Set httpOnly cookie (dtms_token) + CSRF cookie      │
│                    ↓                                    │
│  10. Redirect berdasarkan role:                         │
│      - SUPER_ADMIN → /tenants                          │
│      - DRIVER → /driver                                │
│      - Lainnya → /dashboard                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Session Management

| Aspek | Detail |
|-------|--------|
| **Token Type** | JWT (HS256 via `jose`) |
| **Cookie Name** | `dtms_token` |
| **Expiry** | 12 jam (configurable via `SESSION_HOURS`) |
| **HttpOnly** | Ya (tidak bisa diakses JS) |
| **Secure** | Ya (production only) |
| **SameSite** | Lax |
| **pwdVersion** | Increment saat password diubah → invalidasi semua session |
| **Logout** | Hapus cookie (JWT stateless, tetap valid jika cookie lama dikirim) |

### 5.3 2FA (TOTP)

| Aspek | Detail |
|-------|--------|
| **Standard** | TOTP (RFC 6238), kompatibel Google Authenticator |
| **Secret** | 20 random bytes → Base32 |
| **Encryption** | AES-256-GCM sebelum simpan (totp-encrypt.ts) |
| **Window** | ±1 step (30 detik per step) |
| **Backup Codes** | 8 kode, format `XXXXX-XXXXX`, SHA-256 hashed |
| **Setup Flow** | GET /api/auth/2fa/2fa/setup → QR code → POST verify → enabled |

### 5.4 9 Level RBAC

| Role | Label | Akses Utama |
|------|-------|-------------|
| `SUPER_ADMIN` | Super Admin | Kelola semua tenant, demo request, audit log global |
| `ADMIN_OPERASIONAL` | Admin Operasional | Semua fitur operasional + kelola user + wildcard `*` permission |
| `DISPATCHER` | Dispatcher | Pengiriman, kurir, kendaraan, dispatch, live map |
| `WAREHOUSE` | Warehouse | Scan gudang, sort, warehouse operations |
| `SUPERVISOR` | Supervisor | Dashboard, laporan, monitoring driver |
| `MANAGEMENT` | Management | Dashboard, analitik, laporan eksekutif |
| `CUSTOMER_SERVICE` | Customer Service | Tracking, notifikasi, customer management |
| `DRIVER` | Driver/Kurir | App driver (route terpisah `/driver`) |
| `CUSTOMER` | Customer | Tracking publik, portal customer |

### 5.5 Permission System (44 Permissions)

```
TENANT:      read, create, update, delete
USER:        read, create, update, delete
DRIVER:      read, create, update, delete, assign
VEHICLE:     read, create, update, delete
CUSTOMER:    read, create, update, delete
SHIPMENT:    read, create, update, cancel, assign, export
DELIVERY:    read, dispatch, start, complete, fail, reschedule
WAREHOUSE:   read, scan, sort, update
REPORT:      view, export
AUDIT:       read
GEOFENCE:    read, create, update, delete
NOTIFICATION: read, send
ORGANIZATION: read, create, update, delete
SETTINGS:    read, update, delete
SLA:         read, create, update, delete
EXCEPTION:   read, create, update, assign
ANALYTICS:   view
CONTROL_TOWER: view
DISPATCH:    view, assign
INTEGRATION: read, create, update, delete
WEBHOOK:     read, create, update, delete
API_KEY:     read, create, delete
BILLING:     read, manage
GPS:         send, read
FILE:        read, upload
DAILY_REPORT: read, create
```

### 5.6 API Authentication Methods

| Method | Header | Keterangan |
|--------|--------|------------|
| **JWT Cookie** | `dtms_token` cookie | Default untuk web client |
| **API Key** | `Authorization: Bearer dtms_*` | Untuk integrasi pihak ketiga |

API Key di-hash SHA-256 sebelum disimpan, hanya prefix yang ditampilkan. Validasi: active + not expired + tenant active.

### 5.7 Guard Functions

```typescript
guard(...roles)                    // Auth + role check + tenant throttle
guardPermission(permission, ...roles) // Auth + role + permission + scope
requireAuth(...roles)              // HOF wrapper untuk route handler
requirePermission(permission, ...) // HOF wrapper dengan permission check
guardPlanLimit(session, resource)  // Cek plan limit (users/drivers/shipments)
logAudit(session, action, ...)     // Tulis audit log
```

---

## 6. Isolasi Data Multi-Tenant

### 6.1 Arsitektur

```
Request masuk
  → Middleware: verifikasi JWT, extract tenantId
  → guardPermission(): resolve access scope
  → runWithTenant(tenantId, async () => {
      // AsyncLocalStorage menyimpan tenantId
      // Semua query Prisma otomatis di-scoping
    })
```

### 6.2 Prisma Query Middleware

**27 model** di-intercept otomatis oleh middleware:

| Operasi | Mekanisme |
|---------|-----------|
| `findUnique` | Post-check: query lalu verifikasi `result.tenantId === context.tenantId` |
| `findMany` / `findFirst` / `count` | Pre-filter: inject `WHERE tenantId = X` |
| `create` / `createMany` | Auto-inject: tambahkan `tenantId` ke data |
| `update` / `updateMany` | Pre-filter: tambahkan ke WHERE clause |
| `delete` / `deleteMany` | Pre-filter: tambahkan ke WHERE clause |

### 6.3 Model Tenant-Scoped

User, Customer, Shipment, ShipmentStop, ShipmentItem, Driver, Vehicle, VehicleMaintenance, DailyReport, Company, Branch, Department, Warehouse, Hub, ShipmentEvent, Exception, SlaPolicy, SlaEvent, Subscription, Invoice, Payment, UsageRecord, IntegrationConfig, ApiKey, WebhookSubscription, UploadedFile, DemoRequest, RolePermission, Message, TenantRateLimit

### 6.4 Model tanpa tenantId (Manual Filtering)

| Model | Filter Via |
|-------|-----------|
| DeliveryAssignment | `shipment.tenantId` |
| TrackingEvent | `shipment.tenantId` |
| GpsLog | `driver.tenantId` |
| ProofOfDelivery | `shipment.tenantId` |
| Notification | `shipment.tenantId` |
| AuditLog | `user.tenantId` |
| WarehouseScan | `shipment.tenantId` |
| GeofenceEvent | `geofence.tenantId` |
| WebhookDelivery | `subscription.tenantId` |
| IntegrationLog | `integration.tenantId` |

### 6.5 SUPER_ADMIN

- `tenantId: null` di database
- Middleware tidak melakukan filtering (bisa akses semua tenant)
- Permission wildcard `['*']` (akses semua permission)
- Redirect ke `/tenants` untuk operational routes

---

## 7. Modul-modul Aplikasi

### 7.1 Shipment Management

**Alur Status:**
```
ORDER_CREATED → WAREHOUSE_RECEIVED → DISPATCHED → IN_TRANSIT →
  ARRIVED_AT_HUB → OUT_FOR_DELIVERY → DELIVERED

Status Alternatif:
  DELIVERY_FAILED → RESCHEDULED → (OUT_FOR_DELIVERY)
  DELIVERY_FAILED → RETURN_TO_SENDER → RETURNED
```

**Tracking Number:** `DTMS-YYYYMMDD-XXXXXX` (6 digit random)

**Service Types:**
| Type | SLA | Keterangan |
|------|-----|------------|
| SAME_DAY | 12 jam | Pengiriman hari yang sama |
| NEXT_DAY | 24 jam | Pengiriman keesokan hari |
| REGULAR | 96 jam | Pengiriman reguler 2-4 hari |

**Fitur:**
- Multi-stop routing (ShipmentStop)
- Line items (ShipmentItem)
- Auto SLA deadline calculation
- WhatsApp status notification
- Warehouse scanning
- Proof of Delivery (tanda tangan + foto + GPS)

### 7.2 Driver Management

**Fitur:**
- CRUD lengkap dengan `employeeId` unik
- Link ke User account untuk login
- **Driver Scoring**: `100 × (0.5 × completionRate + 0.3 × onTimeRate) × failFactor`
- Status ACTIVE/INACTIVE
- Return-to-base tracking
- Daily reports (delivered, failed, rescheduled, fuel)

**Driver App Flow:**
```
Login → Dashboard (tasks summary) → Task List → Detail Task
  → Mulai Perjalanan (IN_TRANSIT)
  → GPS Sender (otomatis, real-time)
  → Tiba di Tujuan (OUT_FOR_DELIVERY)
  → POD: receiverName + signature + photo + GPS
  → Gagal: reason + photo evidence
  → Return to Base
  → Daily Report
```

### 7.3 Vehicle Management

**Fitur:**
- CRUD dengan `vehicleNumber` unik
- Foto 4 sisi (front, back, right, left)
- Capacity tracking
- **Auto-maintenance**: trigger setelah 2000 km
- Total distance tracking (update otomatis saat POD)
- Status: ACTIVE/INACTIVE, returning state

### 7.4 GPS & Live Tracking

**Endpoint GPS:** `POST /api/gps`
- Menerima: latitude, longitude, speed, heading, accuracy, battery
- Otomatis: geofence check, distance accumulation, maintenance alerts

**Data Latest:** `GET /api/gps/latest?minutes=120`
- Driver positions + vehicle info + warehouse
- Active shipments with routes
- Multi-stop waypoints

**Peta Features:**
- Marker driver real-time
- Shipment routes (origin → stops → destination)
- Geofence overlay (warehouse/hub/operational area)
- Heatmap
- Auto-refresh polling

### 7.5 Geofencing

**Types:** WAREHOUSE, HUB, OPERATIONAL_AREA, DESTINATION

**Flow:**
```
GPS Update → checkGeofences(driverId, lat, lng)
  → Hitung jarak (haversine) ke setiap geofence aktif
  → Jarak <= radius & last event = EXIT → GeofenceEvent(ENTER)
  → Jarak > radius & last event = ENTER → GeofenceEvent(EXIT)
  → Buat notifikasi otomatis
```

### 7.6 ETA Engine

**Formula:**
```
distance = haversine(currentLat, currentLng, destLat, destLng)
speed = timeOfDayModel(hour)
  - Rush hour (6-9, 16-19): 20 km/h
  - Night (22-5): 45 km/h
  - Normal: 35 km/h
eta = (distance × 1.3 road factor) / speed × 60 (minutes)
```

**Multi-stop:** Iterative distance calculation through all waypoints.

### 7.7 SLA Monitoring

**Policy per service type + origin/dest city:**
```typescript
calculateSlaDeadline(shipment) → Date
evaluateSlaStatus(shipment) → ON_TRACK | AT_RISK | BREACHED
```

**Alert:** Automatic scan via `scripts/alert-scheduler.js` atau Vercel cron `/api/system/alerts`.

### 7.8 Control Tower

**Data:** KPIs (on-time rate, active shipments, exceptions), resource utilization, alerts, recent events.

**Permission-gated:** `CONTROL_TOWER.VIEW`

### 7.9 Dispatch

**Flow:**
```
List unassigned shipments + available drivers/vehicles
  → Assign: POST /api/dispatch
  → Creates DeliveryAssignment
  → SSE broadcast for real-time update
  → WhatsApp notification
```

### 7.10 Warehouse Operations

**Scan Actions:** RECEIVE, SORT, DISPATCH, ARRIVE_HUB

**Flow:**
```
Input shipment ID/QR → Pilih aksi → Catatan + GPS → POST /api/warehouse/scans
  → Buat WarehouseScan record
  → Update shipment status
  → Audit trail
```

### 7.11 Proof of Delivery (POD)

**Fields:**
- `receiverName`: Nama penerima
- `signature`: Base64 tanda tangan digital
- `photo`: URL foto bukti
- `latitude/longitude`: Koordinat GPS
- `notes`: Catatan tambahan

**Side effects:**
- Update shipment status → DELIVERED
- Update `vehicle.totalDistanceKm`
- WhatsApp notification
- SLA event evaluation

### 7.12 Notifications

**In-App Events:** SLA breach, GPS disconnect, geofence enter/exit, demo request

**WhatsApp Templates:**
- Status update (diterima/diambil/diberangkatkan/dll.)
- SLA breach alert (ke admin)
- GPS disconnect alert (ke admin)
- Delivery failed notification (ke customer)

### 7.13 Analytics & Reporting

**Dashboard KPIs:**
- Total shipment aktif/delivered/gagal
- Driver aktif/returning
- Kendaraan available/busy
- Grafik status breakdown

**Driver Scoring:**
```
score = 100 × (0.5 × completionRate + 0.3 × onTimeRate) × failFactor
```

**Advanced Analytics:**
- Tren 7 hari
- Top destinasi
- Average hours per shipment
- On-time rate
- Vehicle telemetry (speed, battery)

---

## 8. API Reference

### 8.1 Ringkasan Endpoint (83+ Routes)

#### Auth (12 routes)

| Method | Endpoint | Akses | Keterangan |
|--------|----------|-------|------------|
| POST | `/api/auth/login` | Public | Login |
| POST | `/api/auth/logout` | Auth | Logout |
| GET | `/api/auth/me` | Auth | Info session |
| POST | `/api/auth/two-factor` | Public | Verifikasi TOTP |
| POST | `/api/auth/forgot-password` | Public | Reset via WhatsApp |
| POST | `/api/auth/reset-password` | Public | Reset dengan token |
| POST | `/api/auth/change-password` | Auth | Ubah password |
| GET | `/api/auth/tenants` | Public | Daftar tenant aktif |
| GET | `/api/auth/2fa/setup` | Auth | Generate TOTP secret |
| POST | `/api/auth/2fa/setup` | Auth | Verify & enable 2FA |
| POST | `/api/auth/2fa/disable` | Auth | Disable 2FA |
| GET | `/api/auth/google` | Public | Google OAuth redirect |
| GET | `/api/auth/google/callback` | Public | Google OAuth callback |

#### Shipments (8 routes)

| Method | Endpoint | Akses | Keterangan |
|--------|----------|-------|------------|
| GET | `/api/shipments` | Auth | List (search, pagination, filter) |
| POST | `/api/shipments` | Auth | Buat shipment baru |
| GET | `/api/shipments/[id]` | Auth | Detail |
| PUT | `/api/shipments/[id]` | Auth | Update |
| DELETE | `/api/shipments/[id]` | Auth | Hapus |
| POST | `/api/shipments/[id]/assign` | Auth | Assign driver+vehicle |
| GET | `/api/shipments/[id]/events` | Auth | List events |
| POST | `/api/shipments/[id]/events` | Auth | Tambah event |
| GET | `/api/shipments/[id]/pod` | Auth | Get POD |
| POST | `/api/shipments/[id]/pod` | Auth | Submit POD |
| POST | `/api/shipments/[id]/scan` | Auth | Warehouse scan |

#### Drivers (5 routes)

| Method | Endpoint | Akses | Keterangan |
|--------|----------|-------|------------|
| GET | `/api/drivers` | Auth | List (dengan scoring) |
| POST | `/api/drivers` | Auth | Tambah driver |
| GET | `/api/drivers/[id]` | Auth | Detail |
| PATCH | `/api/drivers/[id]` | Auth | Update |
| DELETE | `/api/drivers/[id]` | Auth | Hapus |

#### Driver Portal (7 routes)

| Method | Endpoint | Akses | Keterangan |
|--------|----------|-------|------------|
| GET | `/api/driver/tasks` | DRIVER | Daftar tugas |
| GET | `/api/driver/tasks/[assignmentId]` | DRIVER | Detail tugas |
| POST | `/api/driver/tasks/[assignmentId]` | DRIVER | Update tugas |
| GET | `/api/driver/status` | DRIVER | Status driver |
| PUT | `/api/driver/status` | DRIVER | Update status |
| POST | `/api/driver/return` | DRIVER | Return to base |
| POST | `/api/driver/sync` | DRIVER | Sync data |
| GET | `/api/driver/daily-report` | DRIVER | List laporan |
| POST | `/api/driver/daily-report` | DRIVER | Buat laporan |

#### Vehicles (7 routes)

| Method | Endpoint | Akses | Keterangan |
|--------|----------|-------|------------|
| GET | `/api/vehicles` | Auth | List |
| POST | `/api/vehicles` | Auth | Tambah |
| GET | `/api/vehicles/[id]` | Auth | Detail |
| PATCH | `/api/vehicles/[id]` | Auth | Update |
| DELETE | `/api/vehicles/[id]` | Auth | Hapus |
| GET | `/api/vehicles/[id]/maintenance` | Auth | List maintenance |
| POST | `/api/vehicles/[id]/maintenance` | Auth | Tambah maintenance |

#### Customers (5 routes)

| Method | Endpoint | Akses | Keterangan |
|--------|----------|-------|------------|
| GET | `/api/customers` | Auth | List |
| POST | `/api/customers` | Auth | Tambah |
| PATCH | `/api/customers/[id]` | Auth | Update |
| DELETE | `/api/customers/[id]` | Auth | Hapus |

#### GPS & Tracking (6 routes)

| Method | Endpoint | Akses | Keterangan |
|--------|----------|-------|------------|
| POST | `/api/gps` | Auth/DRIVER | Kirim GPS |
| GET | `/api/gps/latest` | Auth | GPS terakhir |
| GET | `/api/gps/global` | Auth (SA) | GPS global |
| GET | `/api/gps/return-timeline` | Auth | Timeline return |
| POST | `/api/tracking/ingest` | Auth | GPS batch ingestion |
| GET | `/api/tracking/current` | Auth | Current tracking |
| GET | `/api/tracking/[resi]` | Public | Tracking publik |

#### Tenants (5 routes)

| Method | Endpoint | Akses | Keterangan |
|--------|----------|-------|------------|
| GET | `/api/tenants` | Auth (SA) | List |
| POST | `/api/tenants` | Auth (SA) | Tambah |
| GET | `/api/tenants/[id]` | Auth (SA) | Detail |
| PATCH | `/api/tenants/[id]` | Auth (SA) | Update |
| DELETE | `/api/tenants/[id]` | Auth (SA) | Hapus |

#### Users (8 routes)

| Method | Endpoint | Akses | Keterangan |
|--------|----------|-------|------------|
| GET | `/api/users` | Auth (Admin+) | List |
| POST | `/api/users` | Auth (Admin+) | Tambah |
| GET | `/api/users/[id]` | Auth (Admin+) | Detail |
| PATCH | `/api/users/[id]` | Auth (Admin+) | Update |
| DELETE | `/api/users/[id]` | Auth (Admin+) | Hapus |
| POST | `/api/users/invite` | Auth (Admin+) | Invite |
| POST | `/api/users/reset-password` | Auth (Admin+) | Reset password |
| POST | `/api/users/bulk-import` | Auth (Admin+) | Bulk import |
| GET | `/api/users/[id]/activity` | Auth (Admin+) | Activity log |

#### Control Tower, Dispatch, Analytics, Exceptions, SLA

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/api/control-tower` | KPI, resources, alerts |
| GET | `/api/dispatch` | Unassigned shipments |
| POST | `/api/dispatch` | Assign driver+vehicle |
| GET | `/api/analytics` | 7-day trends, telemetry |
| GET | `/api/exceptions` | List exceptions |
| POST | `/api/exceptions` | Create exception |
| PATCH | `/api/exceptions/[id]` | Update exception |
| GET | `/api/sla-policies` | List SLA policies |
| POST | `/api/sla-policies` | Create SLA policy |
| GET | `/api/sla-events` | List SLA events |

#### Billing, Integrations, Webhooks, API Keys

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/api/billing` | Plans + subscription + usage |
| POST | `/api/billing` | Subscribe to plan |
| GET | `/api/billing/invoices` | List invoices |
| POST | `/api/billing/cancel` | Cancel subscription |
| GET | `/api/integrations` | List integrations |
| POST | `/api/integrations` | Create (dengan URL safety check) |
| POST | `/api/integrations/import-export` | CSV import/export |
| GET | `/api/webhooks` | List webhooks |
| POST | `/api/webhooks` | Create (dengan URL safety check) |
| GET | `/api/api-keys` | List API keys |
| POST | `/api/api-keys` | Create API key |

#### System, Notifications, Other

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/api/health` | Health check |
| GET | `/api/metrics` | Prometheus metrics |
| GET | `/api/events` | SSE stream |
| GET | `/api/notifications` | List notifikasi |
| POST | `/api/notifications/read` | Mark as read |
| GET | `/api/audit` | Audit log |
| POST | `/api/upload` | Upload file |
| POST | `/api/demo-request` | Submit demo |
| GET | `/api/messages` | List messages |
| POST | `/api/messages` | Send message |
| POST | `/api/whatsapp/webhook` | WhatsApp webhook |
| GET | `/api/admin/system-health` | System health |
| GET/PUT | `/api/admin/throttle` | Tenant rate limits |
| POST | `/api/warehouse/scans` | Warehouse scans |
| GET | `/api/daily-reports` | Daily reports |
| GET | `/api/shipment-events` | Shipment events |
| GET | `/api/customer/shipments` | Customer shipments |
| GET | `/api/eta` | ETA calculation |

---

## 9. Middleware & Keamanan

### 9.1 Next.js Middleware (`src/middleware.ts`)

**Jalur eksekusi untuk setiap request:**

```
1. JWT Verification
   → Verifikasi dtms_token cookie
   → Decode payload: { id, name, role, tenantId, plan, planFeatures }

2. CSRF Protection (POST/PUT/PATCH/DELETE)
   → Generate/verify dtms_csrf cookie
   → Verifikasi x-csrf-token header
   → Constant-time comparison (manual XOR, edge-compatible)
   → Exempt: auth endpoints, API key requests

3. Rate Limiting (in-memory buckets)
   → Login: RATE_LOGIN_LIMIT/min (default 10, max 30 in production)
   → GPS: RATE_GPS_LIMIT/min (default 60)
   → API: RATE_API_LIMIT/min (default 300)

4. Role-Based Routing
   → SUPER_ADMIN: redirect operational routes → /tenants
   → DRIVER: only /driver routes allowed
   → Non-DRIVER: cannot access /driver routes

5. Feature Gating (by plan)
   → /control-tower → control_tower feature
   → /dispatch → dispatch feature
   → /reports, /analytics → reports feature
   → /sla, /exceptions → sla feature
   → /integrations → integrations feature

6. Security Headers
   → X-Frame-Options: DENY
   → X-Content-Type-Options: nosniff
   → HSTS: max-age=63072000; includeSubDomains; preload
   → CSP: default-src 'self', frame-ancestors 'none'
   → Referrer-Policy: strict-origin-when-cross-origin
   → Permissions-Policy: camera=(self), geolocation=(self)
   → X-XSS-Protection: 1; mode=block
   → X-DNS-Prefetch-Control: off
   → Cross-Origin-Opener-Policy: same-origin
   → poweredByHeader: false
```

### 9.2 Brute-Force Protection (`src/lib/security.ts`)

| Parameter | Nilai Default | Env Var |
|-----------|---------------|---------|
| MAX_USER_FAILURES | 5 | `MAX_LOGIN_ATTEMPTS` |
| MAX_IP_FAILURES | 20 | - |
| Window | 15 menit | - |
| Backoff Threshold | 3 failures | - |
| Backoff Formula | `15 × 2^(failures-2)` menit | - |
| Cleanup | 24 jam | - |

### 9.3 Rate Limiting

**3 Layer:**

| Layer | Lokasi | Mekanisme |
|-------|--------|-----------|
| Middleware | `src/middleware.ts` | In-memory per-IP buckets |
| Security | `src/lib/security.ts` | Redis (Upstash) + in-memory fallback |
| Tenant | `src/lib/api-guard.ts` | Per-tenant `TenantRateLimit` model |

### 9.4 CSRF Protection

- **Cookie**: `dtms_csrf` (httpOnly: false, JS-readable)
- **Header**: `x-csrf-token`
- **Comparison**: Manual constant-time XOR (edge-compatible)
- **Exempt**: Auth endpoints (login, tenants), API key requests

### 9.5 SSRF Protection

```typescript
isUrlSafe(url) → { safe, reason? }
// Blocks: 127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, localhost, ::1
// Blocks: file://, gopher:// schemes
// Applied to: webhooks, integrations
```

### 9.6 Security Headers

| Header | Nilai |
|--------|-------|
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload |
| Content-Security-Policy | default-src 'self'; frame-ancestors 'none'; base-uri 'self' |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | camera=(self), microphone=(), geolocation=(self) |
| X-XSS-Protection | 1; mode=block |
| X-DNS-Prefetch-Control | off |
| Cross-Origin-Opener-Policy | same-origin |

### 9.7 OWASP Top 10 Compliance

| Kategori | Status | Detail |
|----------|--------|--------|
| A01: Broken Access Control | PASS | Prisma tenant scoping, RBAC, middleware auth |
| A02: Cryptographic Failures | PASS | bcrypt 10, AES-256-GCM, httpOnly cookies |
| A03: Injection | PASS | Prisma ORM, parameterized queries, CSP |
| A04: Insecure Design | PASS | Multi-layer rate limiting, exponential backoff |
| A05: Security Misconfiguration | PASS | Security headers, .env gitignored, production caps |
| A06: Vulnerable Components | PASS | Recent dependencies, no known CVEs |
| A07: Auth Failures | PASS | 2FA, session management, brute-force protection |
| A08: Data Integrity | PASS | Signed JWTs, transactions, file checksums |
| A09: Logging & Monitoring | PASS | Structured logging, audit trail, Sentry |
| A10: SSRF | PASS | URL validation blocks private IPs |

---

## 10. Library & Utilitas

### 10.1 Modul `src/lib/`

| File | Fungsi |
|------|--------|
| `auth.ts` | JWT sign/verify, session management, API key verification |
| `prisma.ts` | Prisma client, AsyncLocalStorage tenant scoping, 27 model middleware |
| `security.ts` | Brute-force, rate limiting (Redis + in-memory), password validation, SSRF check |
| `api-guard.ts` | `guard()`, `guardPermission()`, `runWithTenant()`, `logAudit()` |
| `permissions.ts` | 44 permission definitions across 20 modules |
| `access-scope.ts` | Role → permission resolution, SUPER_ADMIN wildcard |
| `billing.ts` | Plans, subscriptions, invoices, usage tracking, plan limits |
| `constants.ts` | Status labels (ID), colors, SLA hours, city coords, tracking number generator |
| `logger.ts` | Structured JSON logger (prod) / human-readable (dev), timer, child loggers |
| `totp.ts` | TOTP/HOTP implementation, backup codes, QR code URL |
| `totp-encrypt.ts` | AES-256-GCM encryption for TOTP secrets |
| `storage.ts` | File upload: S3/MinIO or local filesystem |
| `whatsapp.ts` | WhatsApp Business API (text, template, status updates, alerts) |
| `eta-engine.ts` | ETA calculation: Haversine + time-of-day speed model |
| `geofence.ts` | Geofence enter/exit detection, auto notifications |
| `scoring.ts` | Driver performance scoring (completion + on-time × fail factor) |
| `alerts.ts` | SLA breach + GPS disconnect alert scanning |
| `provisioning.ts` | Tenant auto-provisioning from DemoRequest |
| `tenant.ts` | Tenant resolution: domain, subdomain, slug, cookie |
| `csrf.ts` | Client-side CSRF helpers, `csrfFetch()` |
| `integration-hub.ts` | OAuth2 flow, CSV import/export, API key generation |
| `job-queue.ts` | In-memory job queue with retry + periodic drain |
| `metrics.ts` | Prometheus-compatible metrics, system metrics (heap, RSS, uptime) |
| `sla.ts` | SLA deadline calculation, batch status evaluation |
| `sse-bus.ts` | Server-Sent Events in-process pub/sub |
| `gps-processor.ts` | Async GPS pipeline: ingest → store → SSE → ETA update |
| `gps.ts` | Client-side browser geolocation |
| `mapTiles.ts` | Map tile provider (Google Maps + CARTO fallback) |
| `landing-data.ts` | Marketing page data (features, stats, pricing) |
| `utils.ts` | `cn()` Tailwind class merge utility |

### 10.2 Fungsi Penting

**ETA Calculation:**
```typescript
calculateEta(shipmentId, currentLat, currentLng) → { etaMinutes, distance, arrivalTime }
calculateBatchEta(shipmentIds, positions) → Map<shipmentId, eta>
```

**Geofence Check:**
```typescript
checkGeofences(driverId, lat, lng, shipmentId?) → void
// Creates ENTER/EXIT events + notifications
```

**Driver Scoring:**
```typescript
driverScore(driverId) → { score, completionRate, onTimeRate, failFactor }
```

**Alert Scan:**
```typescript
scanAlerts() → { slaBreaches, gpsDisconnects }
// Creates notifications + WhatsApp alerts
```

**Tenant Provisioning:**
```typescript
provisionTenant(demoRequestId) → { tenant, user, password }
// Creates tenant + admin user + FREE subscription
```

---

## 11. Billing & Subscription

### 11.1 Plans

| Plan | Harga/Bulan | Harga/Tahun | Max Users | Max Drivers | Max Shipments | Features |
|------|-------------|-------------|-----------|-------------|---------------|----------|
| FREE | Rp 0 | Rp 0 | 3 | 5 | 50 | basic_tracking |
| STARTER | Rp 299.000 | Rp 2.990.000 | 5 | 15 | 200 | + dispatch, reports |
| PRO | Rp 799.000 | Rp 7.990.000 | 15 | 50 | 1.000 | + sla, eta, control_tower, api |
| ENTERPRISE | Rp 1.999.000 | Rp 19.990.000 | unlimited | unlimited | unlimited | + webhooks, integrations, priority_support |

### 11.2 Plan Features → Route Map

| Feature | Routes |
|---------|--------|
| `control_tower` | `/control-tower`, `/global-control-tower` |
| `dispatch` | `/dispatch` |
| `reports` | `/reports`, `/analytics` |
| `sla` | `/sla`, `/exceptions` |
| `integrations` | `/integrations` |

### 11.3 Billing Flow

```
Subscribe → createSubscription(tenantId, planCode, cycle)
  → Upsert subscription
  → Update tenant (plan, maxUsers, maxDrivers, maxShipments, features)
  → Generate invoice (with 11% PPN tax, 14-day due date)

Cancel → cancelSubscription(tenantId)
  → Downgrade to FREE plan
  → Update tenant limits
```

### 11.4 Invoice

- Auto-generated on subscription
- Line items in JSON
- 11% PPN (Pajak Pertambahan Nilai)
- 14-day due date
- Status: PENDING, SENT, PAID, OVERDUE, CANCELLED

---

## 12. Integrasi Eksternal

| Layanan | Fungsi | Konfigurasi |
|---------|--------|-------------|
| **PostgreSQL** | Database utama | `DATABASE_URL` |
| **Upstash Redis** | Rate limiting | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` |
| **WhatsApp Business API** | Notifikasi + alerts | `WHATSAPP_ENABLED`, `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` |
| **Google OAuth 2.0** | SSO login | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| **Sentry** | Error monitoring | `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` |
| **AWS S3 / MinIO** | File storage | `STORAGE_TYPE=s3`, `S3_ENDPOINT`, `S3_BUCKET`, etc. |
| **Leaflet + OpenStreetMap** | Peta interaktif | Client-side |
| **QR Code** | Tracking shipment | `qrcode` package |

### WhatsApp Templates

| Event | Template |
|-------|----------|
| Status Update | "Pesanan Anda telah [status]. Tracking: [number]" |
| SLA Breach | "[trackingNumber] melewati deadline. Segera tindak lanjut." |
| GPS Disconnect | "GPS [driverName] terputus. Posisi terakhir: [lat], [lng]" |
| Delivery Failed | "Pengiriman [number] gagal. Alasan: [reason]" |

---

## 13. Frontend & Halaman

### 13.1 Public Pages

| Route | Halaman |
|-------|---------|
| `/` | Landing page (marketing) |
| `/login` | Login (pilih tenant + credentials) |
| `/tracking` | Cek status resi |
| `/tracking/[resi]` | Detail tracking |
| `/forgot-password` | Request reset password |
| `/reset-password` | Form reset password |

### 13.2 Operations Dashboard (`(ops)/`)

| Route | Halaman | Akses |
|-------|---------|-------|
| `/dashboard` | KPI Dashboard | Admin+ |
| `/control-tower` | Control Tower | Admin+ (plan: control_tower) |
| `/global-control-tower` | Global Control Tower | Super Admin |
| `/shipments` | Daftar Pengiriman | Admin+ |
| `/shipments/[id]` | Detail Pengiriman | Admin+ |
| `/shipments/new` | Buat Pengiriman | Admin+ |
| `/drivers` | Manajemen Driver | Admin+ |
| `/vehicles` | Manajemen Kendaraan | Admin+ |
| `/vehicles/[id]` | Detail Kendaraan | Admin+ |
| `/customers` | Manajemen Pelanggan | Admin+ |
| `/dispatch` | Papan Dispatch | Admin+ (plan: dispatch) |
| `/map` | Live Tracking Map | Admin+ |
| `/reports` | Laporan & Analitik | Admin+ (plan: reports) |
| `/analytics` | Analitik Lanjutan | Admin+ (plan: reports) |
| `/geofences` | Manajemen Geofence | Admin+ |
| `/sla` | Manajemen SLA | Admin+ (plan: sla) |
| `/exceptions` | Manajemen Exceptions | Admin+ (plan: sla) |
| `/warehouse/scan` | Scan Gudang | Warehouse+ |
| `/users` | Manajemen User | Admin+ |
| `/tenants` | Manajemen Tenant | Super Admin |
| `/billing` | Subscription & Billing | Admin+ |
| `/integrations` | Manajemen Integrasi | Admin+ (plan: integrations) |
| `/audit` | Audit Log | Admin+ |
| `/notifications` | Notifikasi | Admin+ |
| `/messages` | Pesan (tenant ↔ SA) | Admin+ |
| `/settings/whatsapp` | Pengaturan WhatsApp | Admin+ |
| `/demo-requests` | Demo Requests | Super Admin |

### 13.3 Driver Portal (`(driver)/`)

| Route | Halaman |
|-------|---------|
| `/driver` | Dashboard driver |
| `/driver/tasks/[assignmentId]` | Detail tugas |
| `/driver/laporan` | Laporan harian |

### 13.4 Customer Portal (`(customer)/`)

| Route | Halaman |
|-------|---------|
| `/customer` | Dashboard customer |
| `/customer/shipments` | Daftar pengiriman |

### 13.5 Account

| Route | Halaman |
|-------|---------|
| `/account/password` | Ubah password |
| `/account/security` | Pengaturan keamanan (2FA) |

---

## 14. Pengujian (Testing)

### 14.1 Konfigurasi

- **Framework**: Vitest 4.1.10
- **Environment**: Node.js
- **Global Setup**: `src/integration/global-setup.ts`
- **Path Alias**: `@` → `src/`

### 14.2 Infrastructure

**Global Setup (`global-setup.ts`):**
- Clear all LoginAttempts (prevents brute-force lockout)
- Login 3 users sequentially: tenantA (admin), tenantB (admin), superAdmin
- Write tokens to `src/integration/.test-tokens.json`
- Runs once before all test files

**Helpers (`helpers.ts`):**
```typescript
getAuth(key: 'tenantA' | 'tenantB' | 'superAdmin') → { cookie, csrf }
api(method, path, body?, auth?) → { status, json, headers }
login(tenantId, username, password) → { cookie, csrf }
loginRaw(tenantId, username, password) → Response
clearLoginAttempts() → void
```

### 14.3 Test Files (10 files, 191 tests)

| File | Tests | C Coverage |
|------|-------|-----------|
| `auth.test.ts` | 25 | Login, logout, session, CSRF, change-password, 2FA |
| `drivers.test.ts` | 15 | CRUD, tenant isolation, plan limits |
| `vehicles.test.ts` | 14 | CRUD, tenant isolation |
| `customers.test.ts` | 14 | CRUD, tenant isolation |
| `shipments.test.ts` | 13 | CRUD, tenant isolation, IDOR |
| `gps.test.ts` | 7 | GPS latest, superadmin global, response time |
| `tenants.test.ts` | 10 | CRUD, authorization |
| `dashboard.test.ts` | 18 | All endpoints, unauthenticated checks |
| `isolation-rbac.test.ts` | 38 | IDOR, tenant scoping, CSRF, unauthenticated |
| `functional-and-isolation.test.ts` | 30 | Auth, isolation, CRUD, performance |

### 14.4 Menjalankan Test

```bash
# Clear login attempts dulu
node scripts/clear-attempts.js

# Jalankan semua test
npx vitest run src/integration/__tests__/ --reporter=verbose --no-file-parallelism

# Jalankan test tertentu
npx vitest run src/integration/__tests__/auth.test.ts
```

### 14.5 Catatan

- Server harus berjalan di port 3000 sebelum test
- `RATE_LOGIN_LIMIT=100` harus diset di `.env` (dev only)
- `--no-file-parallelism` mencegah overlap login di `beforeAll`
- Test menggunakan token caching (global setup), bukan login per file

---

## 15. Script & Maintenance

### 15.1 npm Scripts

| Script | Fungsi |
|--------|--------|
| `npm run dev` | Development server |
| `npm run build` | Build produksi |
| `npm start` | Jalankan build |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Buat migrasi baru (dev) |
| `npm run db:deploy` | Terapkan migrasi (prod) |
| `npm run db:seed` | Isi data contoh |
| `npm run db:reset` | Reset DB + migrasi + seed |
| `npm run alerts:run` | Jalankan alert scan sekali |
| `npm run alerts:scheduler` | Jalankan alert scan sebagai daemon |
| `npm run test` | Jalankan semua test |
| `npm run test:watch` | Jalankan test (watch mode) |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run typecheck` | TypeScript type check |

### 15.2 Scripts (`scripts/`)

| Script | Fungsi |
|--------|--------|
| `stress-burst.ts` | Stress test: 1M+ hierarchi + 1M+ region + tracking events |
| `perf-query.ts` | Direct DB query performance test (27 queries) |
| `perf-stress.ts` | API endpoint performance test (perlu dev server) |
| `bulk-seed.ts` | Bulk data seeding (10K tenants, 10M records) |
| `burst-drivers.ts` | GPS burst testing |
| `clear-attempts.js` | Hapus semua LoginAttempt records |
| `clear-attempts.ts` | TypeScript version |
| `alert-scheduler.js` | SLA & GPS alert daemon |
| `send-whatsapp-test.js` | Test WhatsApp sending |
| `test-billing.js` | Test billing flow |
| `test-integration.js` | Test integration features |
| `test-webhook.js` | Test webhook delivery |
| `seed-roles.ts` | Seed RolePermission data |
| `verify-tenants.ts` | Verify tenant data |
| `fix-scoring.ts` | Fix driver scoring |
| `fix-relations.ts` | Fix data relations |
| `init-permissions.ts` | Initialize permissions |
| `add-rate-limits.ts` | Add tenant rate limits |
| `test-alerts.js` | Test alert system |
| `test-geofence.js` | Test geofence detection |
| `test-gps-queue.js` | Test GPS queue |
| `test-permissions.js` | Test permission system |
| `generate-sa-password.js` | Generate superadmin password |
| `provision-tenant.js` | Provision new tenant |
| `test-eta.js` | Test ETA calculation |

---

## 16. Konfigurasi & Environment

### 16.1 Environment Variables

```env
# === WAJIB ===
DATABASE_URL="postgresql://user:pass@localhost:5432/dtms"
AUTH_SECRET="random-long-string-for-jwt-signing"

# === OPSIONAL ===
SESSION_HOURS="12"                    # JWT expiry (default 12)
ADMIN_USERNAME="admin"                # Default admin
ADMIN_PASSWORD="ganti-password"       # Default admin password

# === RATE LIMITING ===
RATE_LOGIN_LIMIT="10"                 # Login attempts per minute (max 30 in prod)
RATE_API_LIMIT="300"                  # API requests per minute
RATE_GPS_LIMIT="60"                   # GPS requests per minute
MAX_LOGIN_ATTEMPTS="5"                # Brute-force threshold

# === GOOGLE SSO ===
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
APP_URL=""

# === WHATSAPP ===
WHATSAPP_ENABLED="false"
WHATSAPP_API_TOKEN=""
WHATSAPP_PHONE_NUMBER_ID=""
WHATSAPP_BUSINESS_ACCOUNT_ID=""
WHATSAPP_WEBHOOK_VERIFY_TOKEN=""
WHATSAPP_ADMIN_NUMBERS=""

# === REDIS ===
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

# === S3 STORAGE ===
STORAGE_TYPE="local"                   # "local" or "s3"
S3_ENDPOINT=""
S3_BUCKET=""
S3_REGION=""
S3_ACCESS_KEY=""
S3_SECRET_KEY=""

# === SENTRY ===
NEXT_PUBLIC_SENTRY_DSN=""
SENTRY_DSN=""
SENTRY_AUTH_TOKEN=""
SENTRY_ORG=""
SENTRY_PROJECT=""

# === APP ===
APP_URL="http://localhost:3000"
```

### 16.2 Prisma Commands

```bash
npx prisma generate              # Generate client
npx prisma migrate dev           # Create migration (dev)
npx prisma migrate deploy        # Apply migrations (prod)
npx prisma db seed               # Seed data
npx prisma migrate reset --force # Reset database
npx prisma studio                # Open Prisma Studio
```

### 16.3 Vercel Configuration

```json
{
  "crons": [{
    "path": "/api/system/alerts",
    "schedule": "*/5 * * * *"
  }]
}
```

Alert scan berjalan setiap 5 menit via Vercel Cron.

---

## 17. Keamanan (OWASP Top 10)

### 17.1 Ringkasan Compliance

| OWASP | Status | Implementasi |
|-------|--------|-------------|
| **A01** Broken Access Control | PASS | Prisma tenant scoping, RBAC 9 level, 44 permissions, middleware auth |
| **A02** Cryptographic Failures | PASS | bcrypt cost 10, AES-256-GCM (TOTP), httpOnly cookies, SHA-256 (API keys) |
| **A03** Injection | PASS | Prisma ORM (parameterized), no raw HTML, CSP headers |
| **A04** Insecure Design | PASS | 3-layer rate limiting, exponential backoff, password policy |
| **A05** Security Misconfiguration | PASS | 10+ security headers, .env gitignored, production rate limit caps |
| **A06** Vulnerable Components | PASS | Recent deps (Next 15, React 19, Prisma 6), no known CVEs |
| **A07** Auth Failures | PASS | TOTP 2FA, backup codes, session invalidation, brute-force lockout |
| **A08** Data Integrity | PASS | Signed JWTs, DB transactions, file checksums, CSRF |
| **A09** Logging & Monitoring | PASS | Structured logger, audit trail (44 fields), Sentry integration |
| **A10** SSRF | PASS | URL validation blocks private IPs, localhost, non-HTTP schemes |

### 17.2 Layers Keamanan

```
Layer 1: Middleware
  → JWT verification
  → CSRF protection (constant-time comparison)
  → Rate limiting (per-IP)
  → Security headers (10+ headers)
  → Role-based routing

Layer 2: API Guards
  → Permission checks (44 permissions)
  → Tenant throttling (per-TenantRateLimit)
  → Plan limit enforcement

Layer 3: Database
  → Prisma middleware (auto tenant scoping)
  → AsyncLocalStorage (request-scoped tenant)
  → findUnique post-check (IDOR prevention)

Layer 4: Business Logic
  → Password policy (8+ chars, upper/lower/digit)
  → Brute-force protection (exponential backoff)
  → 2FA (TOTP + backup codes)
  → SSRF protection (URL validation)

Layer 5: External
  → Sentry error monitoring
  → WhatsApp webhook signature verification
  → Google OAuth state parameter (HMAC-signed)
```

---

## 18. Deployment & Operasional

### 18.1 Development

```bash
git clone https://github.com/horearmy/dtms.git
cd dtms
npm install
cp .env.example .env    # Isi DATABASE_URL dan AUTH_SECRET
npx prisma migrate dev
npx prisma db seed
npm run dev
```

### 18.2 Production

```bash
npm run build
npm start
# atau deploy ke Vercel
```

### 18.3 Data Seeding

```bash
# Seed dasar (akun demo + sample data)
npm run db:seed

# Bulk seed (10K tenants, 10M records) — hanya untuk testing
npx tsx scripts/bulk-seed.ts
```

### 18.4 Monitoring

- **Health Check**: `GET /api/health` (DB, queue, memory, uptime)
- **Metrics**: `GET /api/metrics` (Prometheus format)
- **System Health**: `GET /api/admin/system-health` (API success rate, webhooks, integrations)
- **Audit Log**: `GET /api/audit` (user actions, IP, user agent)
- **Sentry**: Error tracking + performance monitoring

### 18.5 Maintenance

```bash
# Clear login attempts (jika terkunci)
node scripts/clear-attempts.js

# Run alert scan (SLA breach + GPS disconnect)
npm run alerts:run

# Start alert daemon
npm run alerts:scheduler

# Performance stress test
npx tsx scripts/perf-stress.ts
```

---

---

## 19. Stress Testing & Performance

### 19.1 Overview

DTMS dilengkapi script stress test untuk menguji performa database dan API pada skala besar (10M+ records). Testing dilakukan langsung terhadap PostgreSQL tanpa perlu dev server.

### 19.2 Scripts

| Script | Fungsi | Output |
|--------|--------|--------|
| `scripts/stress-burst.ts` | Bulk data seeding: 1M+ hierarchi, 1M+ region, tracking events | 10M+ rows across 8 tabel |
| `scripts/perf-query.ts` | Direct DB query performance test (27 queries) | Latency metrics (p50, p95, avg) |
| `scripts/perf-stress.ts` | API endpoint stress test (requires dev server) | HTTP response times |

### 19.3 Configuration

Environment variables untuk `stress-burst.ts`:

```env
# Jumlah hierarchy (Organization + Branch) per tenant
HIERARCHY_TOTAL=1000000

# Jumlah region per tenant
REGION_TOTAL=1000000

# Shipment per driver (untuk tracking events)
SHIPMENTS_PER_DRIVER=5
```

### 19.4 Usage

```bash
# Jalankan stress test (bulk seeding)
npx tsx scripts/stress-burst.ts

# Dengan custom targets
HIERARCHY_TOTAL=2000000 REGION_TOTAL=500000 npx tsx scripts/stress-burst.ts

# Jalankan query performance test (tanpa dev server)
npx tsx scripts/perf-query.ts

# Jalankan API stress test (perlu dev server berjalan)
npx tsx scripts/perf-stress.ts
```

### 19.5 Current Database Row Counts

| Tabel | Jumlah Baris | Keterangan |
|-------|-------------|------------|
| `Organization` | 1,945,476 | Hierarki organisasi |
| `Branch` | 3,890,740 | Cabang |
| `Region` | 5,000,001 | Wilayah |
| `Shipment` | 10,117,653 | Data pengiriman |
| `Driver` | 10,000,001 | Data driver |
| `Vehicle` | 10,000,055 | Data kendaraan |
| `GpsLog` | 10,000,000 | Log GPS |
| `TrackingEvent` | 509,839 | Event tracking |
| `Tenant` | 10,057 | Perusahaan |
| `User` | 10,004 | Pengguna |

### 19.6 Query Performance Results

Hasil benchmark dari `perf-query.ts` (PostgreSQL langsung):

| Kategori | Jumlah | Rata-rata | Keterangan |
|----------|--------|-----------|------------|
| Fast (< 100ms) | 22/27 queries | < 2ms (tenant-scoped) | Semua query tenant-scoped sub-2ms |
| Medium (100-500ms) | 1/27 | ~200ms | Aggregate dengan filter |
| Slow (> 500ms) | 4/27 | 1-5s | Aggregate GROUP BY pada 10M+ rows |

**Query tercepat:**
- Tenant-scoped `findMany`: < 1ms
- Tenant-scoped `count`: < 1ms
- `findUnique` by ID: < 1ms

**Query terlambat:**
- `GROUP BY status` pada 10M+ shipments: ~5s (tanpa index)
- `GROUP BY serviceType` + `COUNT`: ~3s
- Aggregate tanpa tenant filter: ~2-5s
- **Rekomendasi**: Buat materialized views atau indexes khusus untuk aggregate queries

### 19.7 Stress Test Execution Flow

```
Phase 1: Hierarchy Seeding (Organization + Branch)
  → 1,000,000 records
  → Batch: 5,000 per insert
  → Duration: ~3 menit
  → Output: Organization + Branch per tenant

Phase 2: Region Seeding
  → 1,000,000 records
  → Batch: 5,000 per insert
  → Duration: ~2 menit
  → Output: Region per tenant

Phase 3: Tracking Events
  → Query existing shipments without events
  → Create TrackingEvent + DeliveryAssignment
  → Batch: 2,000 per insert
  → Duration: ~10 menit
  → Output: Tracking events untuk existing shipments
```

### 19.8 Performance Optimizations Applied

| Optimasi | Lokasi | Dampak |
|----------|--------|--------|
| Paginated `/api/tenants` | `src/app/api/tenants/route.ts` | Hindari load 10K+ tenants |
| Dashboard `take` limits | `src/app/(ops)/dashboard/page.tsx` | Batasi query result |
| Notification tenant scoping | `src/app/api/notifications/route.ts` | Filter per tenant |
| Dynamic `GlobalMap` import | `src/components/` | Code splitting Leaflet |
| Middleware route updates | `src/middleware.ts` | Super Admin dashboard access |

### 19.9 Known Performance Issues

| Issue | Severity | Solusi |
|-------|----------|--------|
| Aggregate GROUP BY pada 10M+ rows | Medium | Materialized views atau indexes khusus |
| Dashboard queries untuk Super Admin (tanpa tenant filter) | Low | `take` limits sudah diterapkan |
| In-memory rate limiting | Low | Perlu Redis untuk multi-instance |

---

## 20. Changelog & Git History

### Recent Commits (Agustus 2026)

| Commit | Deskripsi |
|--------|-----------|
| `0194941` | fix: add Dashboard link to Super Admin sidebar |
| `2cd2543` | fix: add /dashboard to isSuperAdminOnlyRoute |
| `193817f` | feat: add DB query performance test script |
| `a23bd99` | feat: stress test script (1M hierarchies + 1M regions) |
| `923a01c` | perf: paginated tenants, dashboard limits, notification scoping |
| `787daff` | feat: billing UI rewrite (5 tiers, trial banner, addons) |
| `32f2f3b` | fix: logout redirects to landing page |
| `a701116` | feat: unified hierarchy dashboard |
| `0ef8bb0` | fix: permissions seeded for all tenants |
| `6fc1c6f` | fix: comprehensive bug audit (12 fixes) |

### Git Remote

```
Origin: https://github.com/horearmy/dtms.git
Branch: main
```

---

> Dokumentasi ini mencakup seluruh aspek DTMS v2.0.0.
> Untuk dokumentasi spesifik, lihat:
> - `docs/FLOW.md` — Alur aplikasi & arsitektur
> - `docs/MULTI_TENANT_ISOLATION.md` — Detail isolasi data
> - `docs/DTMS_Enterprise_Upgrade_Blueprint.md` — Blueprint upgrade enterprise

