# DTMS — Delivery Tracking Management System
## Dokumentasi Lengkap Sistem

| | |
|---|---|
| **Versi Dokumen** | 1.0 |
| **Tanggal** | 26 Agustus 2026 |
| **Nama File** | `docs/26agustus06_systemDTMS.md` |
| **Status Sistem** | Production-ready (fitur inti), keamanan superadmin setara Blueprint Phase 1–2 |
| **Repo** | `github.com/horearmy/dtms` (branch `main`) |

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Teknologi](#2-teknologi)
3. [Arsitektur Tingkat Tinggi](#3-arsitektur-tingkat-tinggi)
4. [Struktur Direktori](#4-struktur-direktori)
5. [Multi-Tenancy & Isolasi Data](#5-multi-tenancy--isolasi-data)
6. [Model Database](#6-model-database)
7. [Peran & RBAC](#7-peran--rbac)
8. [Autentikasi: Dua Jalur Terpisah](#8-autentikasi-dua-jalur-terpisah)
9. [Keamanan Superadmin (Privileged Access)](#9-keamanan-superadmin-privileged-access)
10. [Keamanan Umum Aplikasi](#10-keamanan-umum-aplikasi)
11. [Modul Bisnis](#11-modul-bisnis)
12. [API Surface](#12-api-surface)
13. [Frontend](#13-frontend)
14. [Optimasi Performa](#14-optimasi-performa)
15. [Realtime & Integrasi](#15-realtime--integrasi)
16. [Testing](#16-testing)
17. [Perintah Operasional](#17-perintah-operasional)
18. [Variabel Lingkungan](#18-variabel-lingkungan)
19. [Checklist Pra-Produksi](#19-checklist-pra-produksi)
20. [Riwayat Perubahan Agustus 2026](#20-riwayat-perubahan-agustus-2026)

---

## 1. Ringkasan Eksekutif

DTMS adalah **platform SaaS multi-tenant** untuk manajemen pengiriman: pelacakan real-time berbasis GPS, optimasi rute via OSRM, manajemen armada (driver/kendaraan/gudang), SLA & exception handling, billing/langganan bertingkat, platform intelligence (analitik/anomali/forecast), serta portal komunikasi tenant ↔ platform admin.

**Karakteristik utama:**
- **63 model database**, **148 endpoint API**, **70+ halaman** dalam 4 route group.
- **Isolasi data fail-closed**: seluruh query/copy tenant-scoped model otomatis difilter oleh Prisma extension berbasis AsyncLocalStorage — tanpa konteks tenant, penulisan ditolak.
- **Dua jalur autentikasi terpisah tegas**: login tenant biasa vs *Secure Admin Portal* untuk superadmin dengan Secret Key + MFA (TOTP/recovery) + Passkey/WebAuthn + sesi server-side revocable + risk engine + step-up authentication.
- **Keamanan berlapis**: CSP ketat, CSRF double-submit, rate limiting berlapis (global/IP/akun), fingerprint binding, audit log menyeluruh.
- Performa halaman terberita turun dari 245 kB → 105 kB First Load JS melalui code-splitting agresif.

---

## 2. Teknologi

| Lapisan | Teknologi | Catatan |
|---|---|---|
| Framework | **Next.js 15** (App Router, React 19) | Server Components + Client Components |
| Bahasa | TypeScript (strict) | `tsc --noEmit` bersih |
| Styling | Tailwind CSS v4 + komponen shadcn/base-ui | |
| Database | PostgreSQL + **Prisma ORM 6** | Extension `$extends` untuk tenant scoping |
| Auth | JWT (jose, HS256) + bcryptjs + TOTP custom + **WebAuthn (@simplewebauthn v13)** | |
| Cache/Limit | In-memory Map (+ `@upstash/redis` tersedia untuk distribusi) | |
| Maps | Leaflet + react-leaflet (dynamic import), tile OSM/Carto | |
| Charts | Recharts (lazy proxy) | |
| PDF/CSV | jsPDF + autotable (lazy), pdf-lib, CsvExport | |
| Storage | AWS S3 SDK (presigned upload) | |
| Monitoring | Sentry (opsional via env), logger terstruktur | |
| WhatsApp | WhatsApp Business Cloud API (Meta) | notifikasi shipment |
| Testing | Vitest (unit + integration HTTP-level) | 24 file / **306 tes** |

---

## 3. Arsitektur Tingkat Tinggi

```text
                        ┌────────────────────────────┐
   Publik               │  Landing / Tracking / Demo │
   ─────────────────►   │  /track · /tracking/[resi] │
                        └──────────┬─────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────────┐
        ▼                          ▼                              ▼
┌───────────────┐        ┌────────────────┐            ┌─────────────────────┐
│ TENANT APP    │        │ DRIVER APP     │            │ PLATFORM ADMIN      │
│ /login        │        │ /driver/*      │            │ /admin/secure-login │
│ /dashboard…   │        │ (mobile-first) │            │ (Secret Key + MFA/  │
│ cookie:       │        │ cookie:        │            │  Passkey + Risk)    │
│ dtms_token    │        │ dtms_token     │            │ cookie:             │
└──────┬────────┘        └──────┬─────────┘            │ dtms_sa_token       │
       │                        │                      └──────┬──────────────┘
       ▼                        ▼                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ MIDDLEWARE (Edge)                                                       │
│ rate limit · CSRF mutasi · role gating · feature gating (plan)          │
│ security headers (CSP/HSTS/…) · paksa ganti password (mcp claim)        │
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ API ROUTES (148) — guard()/guardPermission() → resolveAccessScope()     │
│ runWithTenant(tenantId) → AsyncLocalStorage                             │
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ PRISMA $extends — TENANT SCOPING FAIL-CLOSED                            │
│ findMany/count/create/update/delete otomatis +filter tenantId           │
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼
                     PostgreSQL (63 model)
```

---

## 4. Struktur Direktori

```text
src/
├── app/
│   ├── page.tsx + LandingClient.tsx    # Landing publik (form demo + modal login)
│   ├── login/                          # Login tenant (username+password+perusahaan)
│   ├── admin/secure-login/             # ★ Portal Superadmin (3 langkah)
│   ├── forgot-password/, reset-password/
│   ├── account/{password,security}/    # Ganti password + kelola 2FA/passkey user
│   ├── track/, tracking/[resi]/        # Lacak publik + PWA
│   ├── DemoRequestForm.tsx             # Form permohonan demo (+kode negara & validasi E.164)
│   ├── robots.ts                       # Disallow /admin & /api
│   ├── (customer)/customer/            # Portal customer (lihat kiriman)
│   ├── (driver)/driver/                # App driver: tugas, laporan harian, live map
│   ├── (ops)/                          # Dashboard tenant & platform (lihat §11–13)
│   └── api/**/route.ts                 # 148 endpoint (lihat §12)
├── components/                         # 60+ komponen (maps, charts lazy, UI kit, bell…)
├── lib/                                # 38 modul inti (auth, prisma, security, billing…)
├── integration/                        # Tes integrasi HTTP + global-setup token
└── middleware.ts                       # Edge middleware (keamanan & routing per-role)
prisma/schema.prisma                    # 63 model, 1386 baris
scripts/alert-scheduler.js              # Scheduler alert SLA/ETA
```

---

## 5. Multi-Tenancy & Isolasi Data

### 5.1 Prisma Extension Fail-Closed (`src/lib/prisma.ts`)

- `AsyncLocalStorage` (`tenantStore`) membawa `tenantId` konteks; dibungkus lewat `runWithTenant(id, fn)` di setiap handler.
- **TENANT_SCOPED** (±30 model): `user`, `shipment*`, `driver`, `vehicle`, `customer`, `warehouse`, `invoice`, `notification`, `message`, dll.
- Perilaku:
  - `findMany/findFirst/count` → otomatis injeksi `where.tenantId`.
  - `findUnique` → verifikasi kepemilikan pasca-query (mismatch → `null`).
  - `create/createMany` → tanpa konteks = **ditolak** (`TENANT_CONTEXT_MISSING`), kecuali model di `FAIL_CLOSED_EXEMPT` (auditLog).
  - `update/delete` → filter tenant otomatis.
- Superadmin (`tenantId = null`) mem-bypass filter secara sadar melalui authorization policy, bukan query bebas.

### 5.2 Tenant Lifecycle (9 status)

```text
PROSPECT → PENDING_APPROVAL → ONBOARDING → UAT → ACTIVE ⇄ SUSPENDED
                                                    ↕ GRACE_PERIOD
                    ARCHIVED ← OFFBOARDING ←────────┘   (ARCHIVED → PROSPECT)
```

Transisi divalidasi server-side; perubahan status oleh SA = aksi kritis (wajib step-up, §9.6).

### 5.3 Feature Gating per Plan

JWT membawa `plan` + `planFeatures`; middleware memetakan rute→feature (`ROUTE_FEATURE_MAP`). Halaman terkunci menampilkan upsell `/billing?upgrade=<code>`.

---

## 6. Model Database

**63 model** — dikelompokkan:

| Domain | Model |
|---|---|
| **Inti Pengiriman** | Shipment, ShipmentStop, ShipmentItem, ShipmentEvent, ProofOfDelivery, TrackingEvent |
| **Armada** | Driver, Vehicle, VehicleMaintenance, DailyReport |
| **Gudang** | Warehouse, WarehouseScan |
| **GPS & Geofence** | GpsLog, Geofence, GeofenceEvent |
| **Pelanggan** | Customer |
| **Organisasi** | Organization, Region, Branch, Department, Hub, Company |
| **Tenant Platform** | Tenant, TenantOnboarding, TenantHealthMetric, TenantRateLimit, WhiteLabel |
| **Auth & Akses** | User, Permission, RolePermission, LoginAttempt, PasswordResetToken, AdminSession, PasskeyCredential |
| **Notifikasi & Pesan** | Notification, Message |
| **Billing** | Plan, PlanAddon, TenantAddon, Subscription, Contract, PriceComponent, Invoice, Payment, BillingRun, TaxRule, UsageRecord |
| **SLA & Exception** | SlaPolicy, SlaEvent, Exception |
| **Integrasi** | IntegrationConfig, IntegrationLog, WebhookSubscription, WebhookDelivery, ApiKey |
| **Lain-lain** | AuditLog, UploadedFile, DemoRequest, JobQueue, ScheduledReport, ReportJob |

**Enum kunci:**
- `ShipmentStatus` (14): ORDER_CREATED → PICKUP_SCHEDULED → PICKED_UP → WAREHOUSE_RECEIVED → SORTING → DISPATCHED → IN_TRANSIT → ARRIVED_AT_HUB → OUT_FOR_DELIVERY → DELIVERED / DELIVERY_FAILED / RESCHEDULED / RETURN_TO_SENDER → RETURNED
- `Role` (9): SUPER_ADMIN, ADMIN_OPERASIONAL, DISPATCHER, WAREHOUSE, DRIVER, CUSTOMER_SERVICE, SUPERVISOR, MANAGEMENT, CUSTOMER
- `TenantStatus` (9): PROSPECT … ARCHIVED
- `UserStatus`: ACTIVE/INACTIVE · `OnboardingStatus`: PENDING/IN_PROGRESS/COMPLETED/SKIPPED/FAILED
- `ExceptionType` (11), `IntegrationType` (REST_API/WEBHOOK/SFTP/CSV/EDI)

---

## 7. Peran & RBAC

- **Hardcoded baseline** (`lib/permissions.ts`): matriks PERMISSIONS per role (mis. ADMIN_OPERASIONAL hampir penuh; MANAGEMENT read-only + export; DRIVER terbatas delivery/GPS/laporan).
- **Runtime authority dari DB**: `resolveAccessScope()` membaca tabel `RolePermission` per `(role, tenantId)` — sehingga tiap tenant dapat menyesuaikan izin lewat menu Roles & Permissions.
- `hasPermission(scope,'*')` untuk SUPER_ADMIN.
- Guard utilitas: `guard(...roles)`, `guardPermission(code)`, `requireAuth/requirePermission(+Params)` decorator.

> ⚠️ Catatan: seed default mengikuti baseline; penyesuaian per-tenant bersifat aditif/mengurangi baris DB.

---

## 8. Autentikasi: Dua Jalur Terpisah

| Aspek | Tenant User | Superadmin |
|---|---|---|
| URL | `/login` (atau modal landing "Masuk") | `/admin/secure-login` (link diskret "Portal Admin" di kanan bawah /login) |
| Endpoint | `POST /api/auth/login` | `POST /api/auth/superadmin-login` (step 1/2/3) |
| Faktor | username+password+tenantId | **Secret Key → password → MFA/Passkey** |
| Cookie | `dtms_token` (JWT 12 jam, httpOnly, sameSite lax) | `dtms_sa_token` (JWT 4 jam, sameSite **strict**) |
| Sesi | Stateless (pwdVersion invalidation) | **Server-side revocable** (AdminSession + klaim sid/sv/fp) |
| MFA | TOTP opsional (self-enroll) | TOTP/recovery **atau Passkey**; dapat diwajibkan via env |
| Blokir | Lockout per akun+IP (LoginAttempt) | Lockout IP 3×/15m **+ lockout per-akun progresif** |

**Enforcement Blueprint §38:** `/api/auth/login` menolak SUPER_ADMIN seolah kredensial salah (respons identik dengan kredensial acak — anti-enumeration). Satu-satunya pintu SA adalah secure portal.

**Alur Secure Portal:**
```text
Step 1  Secret Access Key  → timing-safe compare, audit SECRET_OK/FAILED
Step 2  Username + Password → bcrypt; bila totpEnabled:
        return { mfaRequired, mfaToken(5m) }
Step 3  Kode TOTP atau Recovery Code (sekali pakai, hash SHA-256 di DB)
        → issueSuperadminSession(method: password | password+totp | passkey)
```

---

## 9. Keamanan Superadmin (Privileged Access)

Implementasi `docs/DTMS_Superadmin_Security_Authentication_Blueprint.md` — Phase 1 **tuntas**, Phase 2 mayoritas tuntas.

### 9.1 Lapisan Perlindungan Login

| Mekanisme | Detail |
|---|---|
| Secret Key | Env `SUPERADMIN_SECRET_KEY`, timing-safe compare, fail-closed tanpa env |
| IP Allowlist | `SUPERADMIN_ALLOWED_IPS` (kosong = semua; localhost selalu lolos dev) |
| Rate limit IP | 3 gagal / 15 menit |
| **Lockout per-akun** | 5 gagal/15 mnt → delay progresif ×2 s.d. 15 menit (rotasi IP tidak membantu) |
| Password | bcrypt; respons generik anti-enumeration |
| **Risk Engine** | Skor heuristik: IP baru +1, perangkat baru +1, ≥3 gagal/15m +1, jam 00–05 +1 → LOW/MEDIUM/HIGH + alasan; persist ke sesi & audit; `ADMIN_RISK_BLOCK_HIGH=true` menolak HIGH |
| Fingerprint | Token terikat `sha256(ip:ua)`; diverifikasi ulang tiap request (IP dinormalisasi `::ffff:`/loopback) |

### 9.2 Sesi Server-Side Revocable

- Tabel `AdminSession`: sessionHash(SHA-256 sid), ip, ua, authMethod, riskLevel, lastActivityAt, expiresAt, revokedAt.
- Setiap request: cek revoked / absolute expiry (**240 mnt**) / idle timeout (**20 mnt**, sliding dengan throttle tulis 60 detik).
- Rotasi & pencabutan: logout merevoke; `DELETE /api/admin/auth/sessions?id=` per sesi; `POST .../sessions/revoke-all` darurat.
- Cookie: httpOnly, secure(prod), sameSite=strict.

### 9.3 MFA — TOTP + Recovery Codes

- Implementasi TOTP sendiri (RFC 6238, SHA-1/30s/6 digit, window ±1); secret dienkripsi at rest (`totp-encrypt`).
- Enrollment: `/api/auth/2fa/setup` (GET secret+otpauth URL → POST kode → 8 recovery code, disimpan hashed).
- Backup code sekali pakai; habis dipakai dihapus dari store.
- **Wajibkan MFA:** `ADMIN_REQUIRE_MFA=true` → login SA tanpa TOTP terdaftar ditolak.

### 9.4 Passkey/WebAuthn (faktor primer phishing-resistant)

- `@simplewebauthn/server v13`; tabel `PasskeyCredential` (credentialId unique, publicKey base64url, counter, transports, deviceName).
- Enrollment saat sudah login: `register/start` → browser ceremony → `register/verify` (UV required, exclude duplikat).
- Login: `login/start` (username → allowCredentials) → ceremony → `login/verify` → **sesi langsung terbit, method `passkey`**.
- **Clone detection**: counter regressi → kredensial auto-revoked + log error.
- Anti-enumeration: akun tanpa passkey & user tak dikenal → respons generik sama.

### 9.5 securityVersion (§13)

- Klaim `sv` di token SA; divalidasi tiap request.
- `bumpSecurityVersionFromCookie()` dipanggil saat: passkey didaftarkan/dihapus, 2FA diaktifkan/dimatikan (khusus SA) → increment sv + revoke semua sesi privileged **lain** (sesi pemanggil dipertahankan).

### 9.6 Step-Up Authentication (§20–21)

- `POST /api/admin/security/step-up` {password | code} → `stepUpToken` JWT 5 menit.
- Endpoint kritis mewajibkan header `x-step-up-token` (`assertStepUp`), else `403 {stepUpRequired:true}`:
  - `PUT /api/tenants/[id]` — field kritis `status/active/plan`
  - `PUT /api/tenants/[id]/lifecycle` — suspend/activate/offboard
  - `POST /api/superadmin/billing/change-plan`
- UI: `fetchWithStepUp()` (`lib/stepup-client.ts`) menangani prompt + retry transparan (terpasang di toggle aktif tenant & upgrade plan).

### 9.7 Audit & Event (§27–28)

Event bernama standar: `SUPERADMIN_SECRET_OK/FAILED`, `SUPERADMIN_LOGIN_SUCCESS/FAILED/BLOCKED`, `SUPERADMIN_MFA_SUCCESS/FAILED`, `SUPERADMIN_SESSION_CREATED/REVOKED`, `SUPERADMIN_PASSKEY_ADDED/REMOVED`, `SUPERADMIN_STEP_UP_SUCCESS/FAILED`, plus LOGIN_FAILED/CHANGE_PASSWORD/READ_NOTIFICATIONS umum. Riwayat tampil di panel **Security → Devices & Sessions** (badge risiko berwarna + riwayat login).

### 9.8 Policy Terpusat (`lib/admin-policy.ts`)

Satu sumber konfigurasi: requireMFA, maxSessionMinutes, idleTimeoutMinutes, stepUp TTL, lockout tuning — jangan hard-code di banyak file.

---

## 10. Keamanan Umum Aplikasi

| Kontrol | Implementasi |
|---|---|
| Security Headers | CSP strict (`default-src 'self'`), HSTS 2 tahun, X-Frame DENY, nosniff, COOP, Permissions-Policy |
| CSRF | Double-submit: cookie `dtms_csrf` + header `x-csrf-token` untuk semua mutasi non-publik (`patchFetchCsrf` global) |
| Rate Limit | Login 10/menit, GPS khusus, API 300/menit per IP + throttle per-tenant (`TenantRateLimit`) |
| Brute force | `LoginAttempt` + lockout progresif + remainingAttempts di respons |
| Body limit | Mutasi maks 1 MB (413) |
| Paksa ganti password | Klaim `mcp` → middleware redirect `/account/password` & blokir mutasi lain |
| Static assets | Cache immutable 1 tahun untuk `/_next/static` & gambar |
| robots.ts | Disallow `/admin`, `/api` |
| Validasi input | Slice length, regex email/E.164, whitelist field (mis. ADMIN_ONLY_FIELDS tenant) |

---

## 11. Modul Bisnis

### 11.1 Pengiriman (Shipments)
- Buat manual (`/shipments/new`) dengan customer picker; auto-generate resi; 14-status lifecycle dengan transisi tervalidasi (`NEXT_STATUS` map).
- Detail: timeline event, QR resi (lazy), live map (lazy), POD (foto/tanda tangan), assign driver, scan gudang, return flow.
- CSV export + PDF report (lazy).

### 11.2 Dispatch & Control Tower
- Dispatch Board antrian → assign; Control Tower & Global Control Tower (lintas tenant untuk SA) dengan FleetMap dinamis.

### 11.3 Gudang
- Scan in/out/sort (`WarehouseScan`), stok per hub, integrasi status shipment.

### 11.4 GPS, Geofence & ETA
- Ingest `POST /api/gps` (rate-limited khusus, api key/cookie), processor → GpsLog + update posisi assignment.
- Geofence ENTER/EXIT → event + notifikasi; ETA engine (OSRM + profil historis); alert SLA via scheduler (`alerts:run`).

### 11.5 Driver App
- `/driver`: tugas hari ini, start/complete delivery (dengan POD), laporan harian, kirim GPS berkala (`GpsSender`), skor driver (`scoring.ts` — on-time, fail factor, POD).

### 11.6 Pelanggan & Portal Customer
- CRUD customer (+telepon internasional via CountryCodeSelect); portal `/customer` lihat kiriman miliknya.

### 11.7 Laporan & Analytics
- `/reports`: agregat server-rendered, CSV + PDF (lazy); scheduled report & report builder di platform-intelligence.

### 11.8 Platform Intelligence (SA)
11 halaman: overview, anomalies, customers, exceptions, fleet, forecast, integrations, recommendations, report-builder, risk, schedules, system-health — chart recharts lazy, drill-down modal, export data.

### 11.9 Billing
- Plan & addon katalog; subscription per tenant; invoice + payment + contract + billing run + tax rule; change-plan wajib step-up; gate fitur per plan; usage record.

### 11.10 Komunikasi & Notifikasi
- **Tenant → Support**: `/pesan` (kirim/baca; unread badge).
- **SA → Tenant**: `/komunikasi` per-tenant chat view; deep-link dari notifikasi lonceng (`?tenant=`), badge auto-clear, auto-mark-read, polling 30s + visibilitychange.
- Notifikasi internal: bell dropdown (deep-link per jenis: pesan/demo/shipment), halaman `/notifications`, popup toast context.
- WhatsApp Cloud API: template/status notification + test sender (`settings/whatsapp`).

### 11.11 Demo Request & Onboarding
- Form landing (nama/email/perusahaan + telepon internasional tervalidasi) → simpan + notify SA → dikelola di `/demo-requests` (hubungkan ke komunikasi).

### 11.12 Tracking Publik & PWA
- `/track` + `/tracking/[resi]`: status timeline, share WhatsApp (E.164), installable PWA (manifest, service worker register), geofence & SSE updates.

### 11.13 Organisasi & Struktur
Organizations → Regions → Branches → Departments → Hubs; hierarchy viewer; white-label per tenant; integrations hub (REST/webhook/SFTP/CSV/EDI) + webhook delivery log; API keys (hash + prefix, scopes); audit log viewer.

---

## 12. API Surface

148 route, ringkas per kategori (prefix `/api`):

| Kategori | Contoh |
|---|---|
| Auth tenant | `auth/login`, `auth/logout`, `auth/me`, `auth/tenants`, `auth/forgot|reset-password`, `auth/change-password`, `auth/google/*`, `auth/two-factor`, `auth/2fa/{setup,disable}` |
| **Auth superadmin** | `auth/superadmin-login` (step1-3), `admin/auth/sessions{,/revoke-all}`, `admin/auth/passkey{,/register/*,/login/*}`, `admin/security/step-up`, `admin/security/login-history`, `admin/roles`, `admin/security`, `admin/system-health`, `admin/throttle` |
| Shipments | CRUD, `[id]/assign|events|pod|scan`, bulk, tracking ingest |
| Drivers/Vehicles/Customers/Warehouses | CRUD + sub-resource |
| GPS/Geofence | `gps`, `geofences[+]` |
| Tenants (SA) | CRUD, `[id]{,/lifecycle,/health,/onboarding,/white-label}` (lifecycle & field kritis → step-up) |
| Billing | `billing*` (tenant self-service), `superadmin/billing/*` (change-plan, invoices, payments, contracts, runs) |
| Komunikasi | `messages` GET/POST/PATCH, `notifications`, `notifications/read`, `notifications/send`, `whatsapp/send|webhook` |
| Platform data | `analytics`, `control-tower`, `audit`, `daily-reports`, `exceptions`, `sla`, `reports/*`, `platform/reports/*`, `system/alerts` |
| Publik | `demo-request`, `tracking/[resi]`, `auth/tenants` |
| Lainnya | `api-keys`, `webhooks`, `uploads`, `integrations`, `organizations/regions/branches/departments/hubs`, `users[+/reset-password|invite]`, `roles` |

Pola keamanan seragam: `guard()/guardPermission()` + `runWithTenant` + audit `logAudit`.

---

## 13. Frontend

### Route Groups
| Group | Audiens | Shell |
|---|---|---|
| `(public)` + root | calon pelanggan, tracking | Landing |
| `(ops)` | tenant users & superadmin | OpsShell (Sidebar/Header + NotificationsBell + TopLoader) |
| `(driver)` | DRIVER role | Mobile-first |
| `(customer)` | CUSTOMER role | Sederhana |
| `account`, `admin`, `forgot/reset` | utilitas | Mandiri |

### Komponen Kunci
Maps: `FleetMap`, `ShipmentLiveMap`, `DriverLiveMap`, `RoutePreviewMap`, `LocationPicker` (semua leaflet, dynamic). Charts: `recharts-lazy` proxy. Export: `CsvExport`, `ReportPdfExportLazy`. UX: `NotificationsBell` (deep-link + auto-clear), `CountryCodeSelect` (bendera+dial+validasi), `PhoneInput`, `SignaturePad`, `PhotoField`, `PlanGate`, `StatusBadge`, UI kit shadcn-style (`ui.tsx`, form primitives).

### State Data
Client fetch + polling (30s) + visibilitychange refresh; SSE bus (`sse-bus.ts`) untuk push realtime tertentu; TopLoader indikator navigasi; PWA manifest + service worker.

---

## 14. Optimasi Performa

Hasil pengukuran production build:

| Halaman | Sebelum | Sesudah |
|---|---|---|
| `/reports` | 245 kB | **105 kB** (−57%) |
| `/platform-intelligence/*` (11 hal.) | 221–239 kB | **108–118 kB** |
| `/shipments/[id]` | 126 kB | 116 kB |
| Shared baseline | 103 kB | 103 kB (tetap) |

Langkah: `recharts-lazy` proxy (split ±120 kB), PDF export lazy (jspdf ±140 kB hanya saat dipakai), QR & Leaflet maps lazy dengan skeleton pulse, `experimental.optimizePackageImports` (lucide-react, @base-ui/react, recharts).

> ⚠️ Jangan jalankan `npm run build` saat dev server hidup — menimpa `.next` dan menyebabkan error ENOENT/flaky 500 sampai di-restart bersih.

---

## 15. Realtime & Integrasi

- **SSE Bus** (`sse-bus.ts`): channel per tenant untuk push event (status shipment, alerts) ke dashboard.
- **Polling defensif**: notifications bell & unread badges (30s + visibilitychange).
- **Integration Hub**: REST outbound (token exchange), webhook subscription + delivery retry/log, SFTP/CSV/EDI adapters, API Key (prefix + SHA-256 hash, scopes, expiry).
- **WhatsApp Cloud API**: send text/template, inbound webhook, nomor per-shipment notification hooks.

---

## 16. Testing

```bash
npm test          # unit + integration (306 tes / 24 file)
```

- **Unit** (`__tests__` di lib/api): eta, scoring, security, totp, alerts, api-guard, constants, pagination, route handlers login/me/scan/alerts/resi.
- **Integration** (`src/integration/__tests__`): HTTP nyata ke server — auth (termasuk asersi bypass-SA-ditolak), tenants CRUD, drivers, vehicles, customers, shipments, gps, dashboard, isolation-rbac (cross-tenant), functional-and-isolation.
- **Token strategy**: `global-setup.ts` login sekali (tenant via `/api/auth/login`; **SA via secure portal step1+2** lalu probe `/api/auth/me` untuk csrf) → tulis `.test-tokens.json`; helper `api()` menyematkan cookie + csrf. Menghindari lockout brute-force.
- Coverage fungsional penting: RBAC/isolasi lintas-tenant, brute-force lockout, CSRF block, 404 vs 403 semantics.

---

## 17. Perintah Operasional

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server (jangan build paralel!) |
| `npm run build && npm run start` | Production |
| `npm run typecheck` / `npm run lint` | Verifikasi statis |
| `npm test` | Seluruh tes |
| `npm run db:generate` / `db:migrate` / `db:push`* | Prisma (*project sudah drift → gunakan `db push` additive; `migrate dev` akan minta reset) |
| `npm run db:seed` / `db:reset` | Seed / reset+seed |
| `npm run alerts:run` / `alerts:scheduler` | Alert SLA/ETA sekali / daemon |

**Kredensial dev:** Tidak disimpan di repository. Gunakan secret lokal sementara dari environment dan ganti seluruh credential sebelum deployment.

---

## 18. Variabel Lingkungan

| Variabel | Fungsi | Default/dev |
|---|---|---|
| `DATABASE_URL` | PostgreSQL | localhost:5432 |
| `AUTH_SECRET` | Signing JWT (wajib) | tersedia |
| `SUPERADMIN_SECRET_KEY` | Step-1 portal SA | tersedia |
| `SUPERADMIN_ALLOWED_IPS` | Whitelist IP SA (kosong=all) | kosong |
| `RATE_LOGIN_LIMIT` / `RATE_API_LIMIT` / `RATE_GPS_LIMIT` | Rate limit per menit | 10 / 300 / khusus |
| `MAX_IP_FAILURES` | Ambang lockout IP | — |
| `APP_URL` / `NEXT_PUBLIC_APP_URL` | Origin WebAuthn & WA webhook | http://localhost:3000 |
| `SESSION_HOURS` | Umur sesi tenant (jam) | 12 |
| `ADMIN_REQUIRE_MFA` | `true` = tolak login SA tanpa 2FA | false |
| `ADMIN_RISK_BLOCK_HIGH` | `true` = tolak login risiko HIGH | false |
| `ADMIN_SESSION_MINUTES` / `ADMIN_IDLE_MINUTES` / `ADMIN_STEPUP_MINUTES` | Tuning sesi & step-up | 240 / 20 / 5 |
| `TEST_SA_PASSWORD` / `TEST_SA_SECRET_KEY` / `TEST_URL` | Integrasi test | secret manager / secret manager / :3000 |
| `SENTRY_*`, `LOG_LEVEL`, WA credentials, S3 keys | Opsional | — |

---

## 19. Checklist Pra-Produksi

- [x] Seed tidak lagi menyimpan password default dan akun seed dipaksa mengganti password
- [ ] Aktifkan `ADMIN_REQUIRE_MFA=true` setelah semua SA enroll 2FA/Passkey
- [ ] Set `SUPERADMIN_SECRET_KEY` kuat acak + isi `SUPERADMIN_ALLOWED_IPS` (kantor/VPN)
- [ ] Rotasi `AUTH_SECRET` + `DATABASE_URL` credential; matikan logging verbose
- [ ] Domain produksi: set `APP_URL` (origin WebAuthn harus persis); pertimbangkan subdomain admin terpisah (`admin.`) + WAF
- [ ] Rate limit distribusi (Upstash) bila >1 instance
- [ ] Audit: pastikan tidak ada endpoint SA tanpa step-up yang baru ditambahkan (pola `assertStepUp`)
- [ ] Jalankan `npm run build && npm run start` (bukan dev) + smoke login SA & tenant
- [ ] Backup DB terjadwal; monitor tabel `AuditLog`, `LoginAttempt`, `AdminSession`

---

## 20. Riwayat Perubahan Agustus 2026 (Ringkas)

**17–22 Agt** — Rilis awal: multi-tenant isolation, RBAC, billing engine, platform-intelligence, secure-login v1 (secret key + fingerprint + rate limit), TOTP infrastruktur, audit pra-deploy.

**24–25 Agt** — Hardening: hapus fallback secret hardcoded (fail-closed), dokumentasi blueprint, normalisasi IP fingerprint, perbaikan alur pesan tenant→SA (notifikasi tepat sasaran), unread badges + auto-clear + deep-link notifikasi, validasi telepon internasional form demo, lazy-load recharts/PDF/maps (First Load −140 kB), robots.txt.

**26 Agt (sesi ini)** — Keamanan superadmin enterprise:
1. Fix bypass: SA ditolak di login biasa (anti-enumeration)
2. Increment 1: TOTP step-3 + recovery code sekali pakai, lockout per-akun progresif, policy terpusat, robots, force-change flag
3. Increment 2: `AdminSession` server-side (revocable, idle 20m/absolute 240m), endpoint sessions/revoke-all, panel Devices & Sessions + riwayat login
4. Increment 3: **Passkey/WebAuthn** end-to-end (enroll, login passwordless, clone-detection)
5. Increment 4: **securityVersion** (revoke massal saat faktor berubah) + **step-up auth** pada aksi kritis tenant/billing + UI prompt
6. Increment 5: **Risk engine** heuristik + badge + mode blokir HIGH
7. Link "Portal Admin" di /login; fix korupsi `.next` akibat build-paralel-dev (dokumentasikan larangan)

**26 Agt (malam)** — Form shipment baru (tenant): field **Service Type diganti "Estimasi Jarak Tempuh"** (otomatis dari rute OSRM di peta: `distanceKm` + `durationMin` tersimpan di Shipment), **field Nilai Barang dihapus** dari form (kolom DB tetap ada), tambah **2 foto barang** (`photo1`/`photo2` via `/api/upload`), tampil di halaman detail. `serviceType` tetap default REGULAR di backend untuk SLA. Migrasi `20260826223318_shipment_route_estimate_photos`. Catatan ops: drift migrasi pra-ada (bukan dari sesi ini) — `migrate dev` meminta reset; kolom baru diterapkan manual + `migrate resolve`. Dev server wajib restart setelah `prisma generate` (client di memori basi).

**Status akhir:** 306/306 tes hijau, typecheck bersih, semua ter-push ke `origin/main`.

---

*Dokumen ini dihasilkan dari audit langsung kode (schema, routes, lib, middleware, tests) pada 26 Agustus 2026.*
