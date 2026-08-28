# DTMS Codebase Review dan Blueprint

**Proyek:** Delivery Tracking Management System (DTMS)  
**Jenis:** Multi-tenant SaaS untuk operasi delivery dan transport  
**Tanggal review:** 28 Agustus 2026  
**Status dokumen:** Review berbasis repository, bukan sertifikasi keamanan atau persetujuan produksi

## 1. Ringkasan Eksekutif

DTMS adalah aplikasi web untuk perusahaan logistik yang menggabungkan manajemen shipment, dispatch, operasi gudang, aplikasi driver, tracking GPS, proof of delivery, SLA, geofence, komunikasi, analytics, billing, dan administrasi tenant.

Implementasi menggunakan satu aplikasi Next.js dengan PostgreSQL sebagai database utama. Tenant berada pada database yang sama dan dipisahkan dengan `tenantId`, access scope berbasis role/branch, serta extension Prisma berbasis `AsyncLocalStorage`.

### Penilaian singkat

| Area | Penilaian | Catatan |
|---|---|---|
| Cakupan bisnis | Kuat | Modul inti delivery dan platform SaaS tersedia |
| Arsitektur | Layak dikembangkan | Server-centric, route handler, shared library |
| Multi-tenancy | Dirancang serius | Tetap membutuhkan disiplin pada raw query dan relasi |
| Authentication | Kuat untuk baseline | JWT, password version, 2FA, passkey, reset password |
| Operasional GPS | Fungsional | Queue persisten dan SSE tersedia; retention/idempotency perlu dipastikan |
| API contract | Belum seragam | Bentuk response list dan status error belum konsisten di semua route |
| Testing | Ada unit, integrasi, dan E2E artifacts | Hasil historis harus dijalankan ulang pada environment bersih |
| Kesiapan produksi | Bersyarat | Wajib memenuhi checklist secret, database, backup, monitoring, dan data hygiene |

### Kesimpulan utama

Codebase ini dapat menjadi dasar aplikasi baru, tetapi bukan cetak biru yang sebaiknya disalin tanpa penyederhanaan. Untuk rebuild, pertahankan domain model, state machine shipment, boundary keamanan, serta auditability. Sederhanakan modul platform yang belum diperlukan dan tetapkan kontrak API serta model tenant sejak awal.

## 2. Batasan Review dan Sumber Kebenaran

Review ini membaca source code, Prisma schema, package manifest, route/page inventory, test files, konfigurasi deployment, dan dokumentasi repository.

Prioritas sumber kebenaran:

1. `prisma/schema.prisma` untuk model, relasi, dan enum.
2. `src/app/api/**/route.ts` untuk endpoint aktual.
3. `src/app/**/page.tsx` untuk halaman aktual.
4. `src/lib/**` dan `src/middleware.ts` untuk aturan bersama.
5. Test dan audit untuk perilaku yang pernah diverifikasi.
6. README dan dokumen lama untuk konteks, bukan sebagai kontrak aktual.

Dokumen lama memuat beberapa angka atau versi yang dapat berbeda dari package manifest dan schema saat ini. Setiap implementasi baru harus diverifikasi kembali terhadap source code.

## 3. Tujuan Produk dan Aktor

### Tujuan produk

- Mencatat order hingga delivery selesai.
- Memberi dispatcher visibilitas terhadap antrian dan armada.
- Memberi driver workflow tugas, GPS, POD, dan laporan harian.
- Memberi customer tracking status pengiriman.
- Memberi operator kontrol atas SLA, exception, gudang, fleet, dan laporan.
- Menyediakan platform multi-tenant dengan subscription dan white-label.

### Aktor

| Role | Tanggung jawab utama |
|---|---|
| `SUPER_ADMIN` | Mengelola tenant, platform, keamanan, billing, komunikasi, dan monitoring lintas tenant |
| `ADMIN_OPERASIONAL` | Mengelola data dan operasi tenant |
| `DISPATCHER` | Mengatur assignment dan perjalanan delivery |
| `WAREHOUSE` | Scan, sort, dan penerimaan barang di gudang |
| `CUSTOMER_SERVICE` | Customer, reschedule, notifikasi, dan exception pelanggan |
| `SUPERVISOR` | Supervisi armada, shipment, laporan, dan audit operasional |
| `MANAGEMENT` | Membaca KPI, shipment, dan export |
| `DRIVER` | Melihat tugas, mengirim posisi, menyelesaikan atau menggagalkan delivery |
| `CUSTOMER` | Melihat shipment dan notifikasi miliknya |

## 4. Arsitektur Aktual

```text
Browser / Driver device / Public client
              |
              v
Next.js App Router + Middleware
  - route protection
  - JWT/session routing
  - CSRF for browser mutations
  - rate limit
  - security headers
              |
              v
Route Handlers under src/app/api
  - authentication and authorization guards
  - boundary validation
  - tenant context
  - business operations
              |
       +------+-------+----------------+
       |              |                |
       v              v                v
  Prisma/Postgres  Shared libraries  External services
                   auth, ETA, GPS,   S3, Redis, WhatsApp,
                   queue, billing,    Google OAuth, Sentry,
                   geofence, alerts   map providers
```

### Stack yang dideklarasikan

- Next.js App Router dan React 19.
- TypeScript 5.7.
- Tailwind CSS 4 dan komponen UI berbasis shadcn/base UI.
- Prisma dan PostgreSQL.
- `jose` untuk JWT, `bcryptjs` untuk password.
- Leaflet/react-leaflet dan OpenStreetMap/OSRM untuk peta/routing.
- AWS S3 SDK atau storage lokal untuk file.
- Upstash Redis opsional untuk rate limit lintas instance.
- Vitest untuk unit dan integration test.
- Sentry opsional untuk error monitoring.

Package manifest saat review mendeklarasikan Next `15.5.23` dan Prisma package `6.2.1`. Dokumen lama menyebut versi berbeda. Gunakan `package-lock.json` dan hasil `npm ls` sebagai verifikasi dependency yang benar-benar terpasang.

### Konvensi struktur

- `src/app/(ops)`: workspace operasional dan administrasi.
- `src/app/(driver)`: aplikasi driver.
- `src/app/(customer)`: portal customer.
- `src/app/(public)`, `src/tracking`: public tracking.
- `src/app/api`: route handlers.
- `src/components`: komponen bersama dan UI.
- `src/lib`: service, policy, helper, dan domain utility.
- `prisma`: schema, migration, seed.
- `scripts`: scheduler, maintenance, seeding, dan stress utility.

## 5. Modul dan Permukaan Halaman

### Public dan account

| Area | Route |
|---|---|
| Landing | `/` |
| Login | `/login` |
| Forgot/reset password | `/forgot-password`, `/reset-password` |
| Tracking | `/tracking`, `/tracking/[resi]`, `/track` |
| Account security | `/account/password`, `/account/security` |

### Tenant operations

| Area | Route |
|---|---|
| Dashboard | `/dashboard` |
| Shipment | `/shipments`, `/shipments/new`, `/shipments/[id]` |
| Dispatch | `/dispatch`, `/control-tower` |
| Driver dan fleet | `/drivers`, `/vehicles`, `/vehicles/[id]`, `/map` |
| Customer | `/customers` |
| Warehouse | `/warehouse/scan`, `/warehouses` |
| Organisasi | `/organizations`, `/regions`, `/branches`, `/departments`, `/hubs`, `/hierarchy` |
| SLA/geofence/exception | `/sla`, `/geofences`, `/exceptions` |
| Reports/analytics | `/reports`, `/analytics` |
| Integrasi/notifikasi | `/integrations`, `/notifications`, `/pesan`, `/settings/whatsapp` |
| Billing/settings | `/billing`, `/settings/profile` |

### Platform administration

| Area | Route |
|---|---|
| Tenant lifecycle | `/tenants`, `/tenants/[id]`, `/tenant-onboarding` |
| Health and control tower | `/tenant-health`, `/global-control-tower`, `/platform-intelligence/**` |
| Security and audit | `/security`, `/audit`, `/roles` |
| Communication and demo | `/komunikasi`, `/demo-requests` |
| Billing administration | `/billing-management` |

### Driver dan customer

- Driver: `/driver`, `/driver/tasks/[assignmentId]`, `/driver/laporan`.
- Customer: `/customer`, `/customer/shipments`.

## 6. Domain Model dan Database

### Kelompok model

#### Core delivery

- `Shipment`: agregat utama pengiriman, tracking number, sender/receiver, tujuan, service, status, koordinat, SLA, dan relasi.
- `ShipmentItem`: isi shipment.
- `ShipmentStop`: titik multi-stop dengan urutan.
- `DeliveryAssignment`: assignment shipment ke driver dan opsional vehicle.
- `ShipmentEvent`: event detail yang mencatat actor, perubahan status, lokasi, dan metadata.
- `TrackingEvent`: histori status yang digunakan untuk tracking.
- `ProofOfDelivery`: nama penerima, signature, foto, lokasi, catatan, dan waktu delivery.

#### Master data

- `Tenant`, `User`, `Driver`, `Vehicle`, `Customer`.
- `Company`, `Organization`, `Region`, `Branch`, `Department`.
- `Warehouse` dan `Hub`.
- `VehicleMaintenance`.

#### Tracking dan operasi

- `GpsLog`, `Geofence`, `GeofenceEvent`.
- `WarehouseScan`, `DailyReport`.
- `Notification`, `Message`, `Exception`.
- `JobQueue` untuk pekerjaan asynchronous yang persisten.

#### Platform dan subscription

- `Plan`, `Subscription`, `Invoice`, `Payment`, `UsageRecord`.
- `PlanAddon`, `TenantAddon`, `Contract`, `PriceComponent`, `TaxRule`.
- `TenantOnboarding`, `TenantHealthMetric`, `TenantRateLimit`.
- `WhiteLabel`, `DemoRequest`.

#### Security dan integration

- `Permission`, `RolePermission`.
- `AuditLog`, `LoginAttempt`, `AdminSession`.
- `PasswordResetToken`, `PasskeyCredential`.
- `ApiKey`, `IntegrationConfig`, `IntegrationLog`.
- `WebhookSubscription`, `WebhookDelivery`.
- `UploadedFile`.

### Status shipment

Enum `ShipmentStatus` saat ini:

```text
ORDER_CREATED -> PICKUP_SCHEDULED -> PICKED_UP -> WAREHOUSE_RECEIVED
-> SORTING -> DISPATCHED -> IN_TRANSIT -> ARRIVED_AT_HUB
-> OUT_FOR_DELIVERY -> DELIVERED
```

Cabang exception/lifecycle:

```text
OUT_FOR_DELIVERY -> DELIVERY_FAILED -> RESCHEDULED
OUT_FOR_DELIVERY -> RETURN_TO_SENDER -> RETURNED
```


### Service type dan SLA

Service type saat ini: `SAME_DAY`, `NEXT_DAY`, `REGULAR`.

Helper `slaDeadlineFor()` menggunakan konfigurasi `SLA_HOURS` dan fallback 96 jam. `getSLA()` menandai shipment sebagai:

- `NONE` jika deadline tidak ada.
- `DONE` jika status `DELIVERED` atau `RETURNED`.
- `BREACHED` jika deadline lewat.
- `AT_RISK` jika pemakaian waktu minimal 80%.
- `ON_TIME` selain kondisi di atas.

Rebuild sebaiknya menyimpan policy yang dipilih pada shipment atau `SlaEvent`, bukan hanya menghitung ulang dari service type, agar histori tetap konsisten ketika policy berubah.

## 7. Alur Bisnis Utama

### 7.1 Membuat shipment

1. Operator memilih atau membuat sender dan receiver.
2. Operator mengisi origin, destination, item, berat/volume, service type, dan opsi fragile.
3. Sistem memvalidasi input serta access scope.
4. Sistem membuat tracking number.
5. Sistem menentukan deadline SLA bila fitur aktif.
6. Sistem mencatat event `SHIPMENT_CREATED`.
7. Shipment tersedia pada dashboard, queue, dan tracking sesuai aturan akses.

### 7.2 Warehouse intake

1. Petugas mencari atau memindai tracking number.
2. Sistem memvalidasi shipment berada pada tenant dan scope yang benar.
3. Sistem menulis `WarehouseScan`.
4. Sistem memperbarui status dan/atau mencatat `ShipmentEvent`.
5. Shipment masuk queue sorting/dispatch.

Operasi scan perlu idempotency key atau aturan duplicate yang jelas bila scanner mengirim ulang request.

### 7.3 Dispatch

1. Dispatcher melihat shipment yang eligible.
2. Dispatcher memilih driver dan kendaraan.
3. Sistem memvalidasi driver/vehicle aktif, ownership tenant, dan ketersediaan.
4. Sistem membuat `DeliveryAssignment`.
5. Sistem memperbarui status serta histori dispatch.
6. Sistem mengirim notifikasi bila dikonfigurasi.

Assignment dan perubahan status sebaiknya selalu satu transaksi database.

### 7.4 Driver delivery

1. Driver masuk ke aplikasi mobile dan melihat assignment miliknya.
2. Driver memulai tugas atau perjalanan.
3. Perangkat mengirim GPS.
4. Driver dapat menandai arrived, complete/POD, fail, atau reschedule sesuai permission dan state.
5. POD dapat berisi nama penerima, signature, foto, koordinat, dan catatan.
6. Sistem mencatat event, memperbarui status, dan memicu notifikasi/analytics.

### 7.5 Tracking publik

1. Pengunjung memasukkan tracking number.
2. Endpoint publik mencari shipment berdasarkan nomor resi.
3. Response menampilkan status dan histori yang aman untuk publik.
4. Data privat seperti tenant internal, identitas driver, dan koordinat GPS tidak boleh keluar.

### 7.6 Exception dan SLA

1. Scheduler atau operator menemukan shipment lewat SLA atau kondisi gagal.
2. Sistem membuat `Exception` atau `Notification`.
3. Exception dapat assigned, investigated, resolved, verified, lalu closed.
4. Alert dapat dikirim melalui in-app atau WhatsApp.

## 8. Authentication, Authorization, dan Tenant Isolation

### Authentication

- Login lokal memakai username/password.
- Password disimpan sebagai hash bcrypt.
- Session reguler berada pada cookie `dtms_token` yang httpOnly.
- Super admin memiliki cookie/sesi terpisah `dtms_sa_token`.
- JWT membawa user identity, role, tenant, branch, password version, plan, dan feature list.
- User aktif dan `pwdVersion` diverifikasi ulang saat request.
- Forced password change memakai claim `mcp` dan dibatasi middleware.
- TOTP, passkey, password reset, dan Google OAuth tersedia pada modul terkait.
- API key diverifikasi dengan hash, expiry, status, dan scope `read`/`write`.

### Authorization

Permission mengikuti pola `resource.action`, misalnya `shipment.read`, `dispatch.assign`, dan `gps.send`.

Guard utama:

- `guard()` untuk session dan role.
- `guardPermission()` untuk permission database.
- `requireAuth()`/`requireAuthParams()` untuk wrapper route.
- `requirePermission()`/`requirePermissionParams()` untuk wrapper permission.
- `guardPlanLimit()` untuk kuota resource.

`resolveAccessScope()` dan `hasPermission()` adalah pusat resolusi access scope. UI tidak boleh dijadikan satu-satunya pengaman.

### Tenant isolation

`src/lib/prisma.ts` menggunakan `tenantStore` dan daftar `TENANT_SCOPED` untuk:

- Menambahkan filter tenant pada `findMany`, `findFirst`, dan `count`.
- Memeriksa hasil `findUnique` agar record tenant lain atau record tanpa tenant tidak terlihat.
- Menginjeksikan tenant ID saat create dalam konteks tenant.
- Menolak write tanpa konteks tenant, dengan pengecualian eksplisit untuk `AuditLog`.
- Menambahkan tenant predicate pada update/delete.

Batasan penting:

- Raw SQL tidak otomatis melewati extension ini.
- Model tanpa `tenantId` harus diamankan melalui relasi parent atau query scoped.
- Nested writes dan `include` tetap perlu review manual.
- Super admin harus memiliki jalur cross-tenant yang eksplisit dan terbatas.

## 9. API Surface

Route groups aktual meliputi:

| Group | Contoh endpoint |
|---|---|
| Auth | `/api/auth/login`, `/logout`, `/me`, `/change-password`, `/forgot-password`, `/reset-password`, `/2fa/*`, `/google/*` |
| Shipment | `/api/shipments`, `/api/shipments/[id]`, event/assignment/POD terkait |
| Master data | `/api/customers`, `/drivers`, `/vehicles`, `/warehouses`, `/branches`, `/hubs`, `/departments` |
| Operations | `/api/dispatch`, `/warehouse/scans`, `/driver/tasks`, `/driver/sync`, `/daily-reports` |
| Tracking | `/api/tracking/[resi]`, `/api/tracking/current`, `/api/track`, `/api/gps`, `/api/gps/latest`, `/api/gps/global` |
| Platform | `/api/tenants`, `/api/control-tower`, `/api/admin/*`, `/api/audit`, `/api/health` |
| Commercial | `/api/billing`, invoices, addons, superadmin billing |
| Integration | `/api/integrations`, `/api/webhooks`, `/api/api-keys`, `/api/whatsapp`, import/export |
| Files | `/api/upload`, `/api/files/[...path]` |

### Kontrak API yang direkomendasikan untuk rebuild

Gunakan envelope konsisten:

```json
{
  "data": {},
  "meta": { "requestId": "..." }
}
```

Untuk list:

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 25, "total": 100 }
}
```

Untuk error:

```json
{
  "error": {
    "code": "SHIPMENT_NOT_FOUND",
    "message": "Shipment tidak ditemukan",
    "requestId": "..."
  }
}
```


## 10. GPS, ETA, Geofence, dan Queue

### GPS pipeline

1. Route menerima payload GPS.
2. `ingestGps()` memasukkan job `GPS_INGEST`.
3. Worker mengambil job secara batch dengan `FOR UPDATE SKIP LOCKED`.
4. Driver ownership diverifikasi bila ada session user.
5. `GpsLog` disimpan.
6. Posisi dibroadcast melalui SSE.
7. ETA dihitung ulang untuk shipment terkait.
8. Retry memakai exponential backoff sampai batas percobaan.

### Queue dan reliability

`JobQueue` bersifat persistent di Postgres, memakai status `pending`, `running`, `completed`, dan `failed`, serta mendukung locking antar-instance, retry, recovery job stale, dan cleanup history.

### ETA

**Implemented:** ETA dasar memakai average speed default 35 km/jam dan tambahan waktu stop. `eta-engine` juga memakai data shipment/GPS untuk perhitungan batch.

### Billing dan subscription

- Period key dan batas periode.
- Proration.
- Billing run.
- Invoice dan payment.
- Tax rule dan currency IDR.
- Add-on.
- Tenant health/onboarding.

### Integrasi eksternal

- WhatsApp Business gateway: share status dan alert SLA/GPS.
- Google OAuth: login/integrasi.
- OpenStreetMap, Carto, Nominatim, OSRM: tile, geocoding, routing.
- Upstash Redis: rate limiting terdistribusi opsional.
- Sentry: error monitoring.
- Webhook: subscription, delivery retry, response log.

## 11. Security Review

### Kontrol yang sudah diterapkan

- JWT signing dengan secret environment.
- Cookie session httpOnly, secure di production, sameSite lax.
- CSRF cookie `dtms_csrf` dan header `x-csrf-token` untuk browser mutation.
- Rate limit middleware dan tenant throttle.
- Login attempt tracking dan brute-force defense.
- Password version invalidation.
- TOTP/passkey/admin session security.
- Security headers dan CSP.
- File size/type/path validation pada modul upload.
- Audit log untuk mutation penting.
- Public tracking masking dan pembatasan data.
- API key hash serta read/write scope.

### Temuan dan rekomendasi

| Prioritas | Temuan/rekomendasi |
|---|---|
| Tinggi | Jangan mengandalkan in-memory rate limit untuk multi-instance; pastikan Redis aktif dan diuji saat produksi |
| Tinggi | Audit semua raw SQL dan query lintas model terhadap tenant/branch scope |
| Tinggi | Jangan deploy akun demo atau password default; gunakan database produksi fresh |
| Sedang | CSP masih menggunakan `unsafe-inline`; rencanakan nonce/hash bila kompatibel dengan Next.js setup |
| Sedang | Tambahkan idempotency untuk GPS, scan, webhook, POD, dan assignment |
| Sedang | Redaksi PII, coordinate, token, API key, dan secret dalam logger/integration log |
| Sedang | Pastikan cron `/api/system/alerts` benar-benar memiliki route dan secret verification |
| Rendah | Seragamkan envelope response list dan status 401/403 untuk scope API key |




## 12. Testing dan Quality Gates

### Test yang tersedia

- Integration test untuk auth, tenant, isolation/RBAC, shipment, GPS, driver, vehicle, customer, dashboard, dan functional flows.
- TestSprite artifacts untuk login, tracking, tenant management, complaint, dispatch, warehouse, communication, control tower, dan driver tracking.

### Commands

```bash


npm run typecheck
npm run lint
npm test
npm run build
```

### Minimum test matrix untuk rebuild



- Auth: valid/invalid, expired, inactive user, password version, forced change, 2FA, passkey, API key scope.
- Authorization: role salah, permission hilang, branch salah, tenant salah, super admin.
- Shipment: lifecycle valid, transition invalid, duplicate, missing relation, cancel/return.
- Isolation: read/write/delete lintas tenant dan nested relation.
- GPS: coordinate invalid, stale, out-of-order, duplicate, driver ownership, rate limit.
- Upload: type/size/path/ownership, storage failure.
- Billing: quota boundary, subscription change, invoice idempotency.
- UI: loading, empty, error, unauthorized, mobile, focus, retry.



## 13. Deployment dan Operasional

### Environment minimum

- `AUTH_SECRET` dengan nilai acak panjang.
- URL aplikasi publik.
- Credential S3 bila memakai object storage.
- Credential WhatsApp bila mengaktifkan gateway.
- Google OAuth bila mengaktifkan SSO.
- Upstash Redis untuk rate limit lintas instance.
- Sentry variables bila monitoring digunakan.



### Database dan migrasi

- Generate client: `npm run db:generate`.
- Production: `npm run db:deploy`.
- Seed hanya untuk environment yang disiapkan.
- Backup dan restore harus diuji, bukan hanya dikonfigurasi.





### Health dan observability

- `/api/health` dan dashboard health.
- Database latency/error.
- Queue pending/running/failed/stale.
- GPS ingestion rate dan stale driver.
- SLA breach rate.
- 401/403/429/5xx.
- Storage usage dan webhook retry.
- Tenant isolation alerts dan audit event.



## 14. Data Governance dan Retention

- Password hash, reset token, TOTP secret, passkey material.
- API key hash/prefix dan webhook secret.
- Customer phone/address/email.
- POD photo/signature.
- GPS history dan coordinate delivery.
- Audit, integration, dan message payload.


### Kebijakan yang harus ditetapkan

- Retention GPS dan audit.
- Penghapusan tenant dan cascade policy.
- Legal hold/export.
- PII masking pada public tracking.
- Encryption at rest dan in transit.
- Backup encryption serta akses restore.



## 15. Rekomendasi Blueprint Rebuild

### Fase 1: foundation

- PostgreSQL dan migration policy.
- Tenant, user, role, branch scope.
- Session, password, CSRF, audit.
- API envelope, error code, request ID.


### Fase 2: core logistics

- Shipment state machine tervalidasi.
- Warehouse scan.
- Driver, vehicle, assignment.
- Event timeline dan notification.


### Fase 3: delivery execution

- GPS ingestion dan latest position.
- POD dengan storage aman.
- Exception, return, reschedule.


### Fase 4: intelligence

- ETA berbasis routing.
- Geofence.
- Control tower, scoring, analytics.


### Fase 5: SaaS platform

- Plans, limits, subscription, invoice.
- White-label.
- API keys, webhooks, integrations.
- Tenant health dan platform admin.


### Prinsip desain yang harus dipertahankan

1. Tenant isolation adalah security boundary.
2. Semua mutation harus punya actor, scope, state validation, dan audit trail.
3. Status code persisted harus stabil; label UI dapat berubah.
4. Event history append-only semaksimal mungkin.
5. Operasi multi-record harus transaction-safe.
6. Request eksternal harus idempotent atau memiliki deduplication key.
7. Public tracking mengembalikan data minimum.
8. Server melakukan authorization; UI hanya affordance.
9. Asynchronous work harus observable dan recoverable.
10. Dokumentasi API, state transition, dan permission harus menjadi artefak versioned.


## 16. Backlog Perbaikan Prioritas

### P0 sebelum produksi baru

- Bersihkan data uji dan gunakan database produksi fresh.
- Ganti seluruh credential default.
- Verifikasi secret, backup, Redis, storage, WhatsApp, dan cron.
- Jalankan typecheck, lint, test, build pada commit yang akan dirilis.
- Uji tenant isolation dengan dua tenant nyata dan super admin.
- Pastikan public tracking tidak membocorkan PII/GPS.

### P1 untuk reliability

- Tambah idempotency untuk scan, GPS, POD, webhook, dan billing.
- Seragamkan API response envelope.
- Tetapkan status transition matrix terpusat.
- Tambahkan retention/partition strategy untuk `GpsLog`, events, audit, dan integration logs.
- Pisahkan worker dari web process bila beban meningkat.

### P2 untuk maintainability

- Pisahkan domain service dari route handler yang besar.
- Tambahkan schema validation library yang konsisten.
- Kurangi duplikasi policy antara middleware, route, dan UI.
- Buat permission matrix versioned yang dapat diekspor.
- Tambahkan architecture decision records untuk keputusan penting.


## 17. Checklist Penggunaan sebagai Dasar Aplikasi Baru

- [ ] Tentukan apakah aplikasi tetap single-database multi-tenant atau database-per-tenant.
- [ ] Tetapkan tenant, branch, dan cross-tenant admin boundary.
- [ ] Bekukan shipment lifecycle dan event semantics.
- [ ] Tulis permission matrix sebelum membuat halaman.
- [ ] Tetapkan API contract dan error codes.
- [ ] Pilih provider map, storage, queue, email, WhatsApp, dan observability.
- [ ] Tentukan retention, privacy, backup, dan disaster recovery.
- [ ] Buat test fixtures dua tenant, beberapa branch, dan semua role.
- [ ] Pisahkan data demo dari data produksi.
- [ ] Uji release melalui migration, rollback/recovery, health check, dan smoke test.


## 18. Referensi Source Penting

- `src/middleware.ts`: proteksi route, CSRF, rate limit, security headers, feature gate.
- `src/lib/auth.ts`: session, JWT, API key, 2FA token.
- `src/lib/api-guard.ts`: auth/permission/plan guard dan audit.
- `src/lib/prisma.ts`: tenant context dan Prisma extension.
- `src/lib/access-scope.ts`: access scope user.
- `src/lib/permissions.ts`: permission dan role mapping.
- `src/lib/eta.ts`, `src/lib/eta-engine.ts`: SLA/ETA.
- `src/lib/gps-processor.ts`, `src/lib/job-queue.ts`: GPS pipeline dan worker.
- `src/lib/geofence.ts`, `src/lib/geofence-polygon.ts`: geofence.
- `src/lib/billing.ts`, `src/lib/billing-engine.ts`: subscription/billing.
- `src/lib/storage.ts`: upload dan object storage.
- `src/lib/alerts.ts`: SLA/GPS alerts.
- `prisma/schema.prisma`: source of truth database.
- `package.json`: scripts dan dependency declaration.
- `vercel.json`: scheduled deployment task.

## Penutup

DTMS telah berkembang menjadi platform logistik dan SaaS yang luas. Nilai terbesar untuk aplikasi baru bukan menyalin semua halaman, melainkan mempertahankan boundary tenant, model shipment/event, workflow delivery, auditability, dan test matrix. Modul billing, intelligence, white-label, serta integrasi sebaiknya ditambahkan setelah core logistics stabil dan kontrak data telah dibakukan.

## Addendum Verifikasi 28 Agustus 2026

Quality gate yang dijalankan pada repository ini menghasilkan:

- `npm run typecheck`: lulus.
- `npm run lint`: lulus.
- `git diff --check`: lulus.
- `npm test`: **307/307 lulus** pada 24 file setelah database migration dan test contract diperbaiki.

Kegagalan test yang perlu ditindaklanjuti:

1. Global setup sebelumnya menerima `500` saat login `admin00001`; setelah migration dan server test menggunakan schema terbaru, alur tersebut lulus.
2. Test alert dan warehouse scan telah diselaraskan dengan implementasi (`findMany`, error alur gudang, response `200`, dan field `lat`/`lng`) dan kini lulus.

Temuan sebelumnya adalah test/contract drift dan telah diperbaiki. Status test saat ini **hijau**.

Pembaruan verifikasi: `npm run build` kemudian dijalankan dan **lulus** setelah sebelumnya sempat gagal pada page collection. Warning yang tersisa adalah plugin Next.js belum terdeteksi pada konfigurasi ESLint.

## Addendum Security Check 28 Agustus 2026

Pengecekan lanjutan terhadap risiko yang disebut pada review menghasilkan temuan berikut.

### Temuan aktual

| Severity | Lokasi | Temuan | Dampak |
|---|---|---|---|
| High | `src/app/api/system/alerts/route.ts:27-39`, `src/lib/alerts.ts:9-103` | Endpoint mengizinkan `ADMIN_OPERASIONAL`, `DISPATCHER`, dan `SUPERVISOR`, tetapi memanggil `scanAlerts()` tanpa `runWithTenant(session.tenantId, ...)`. Query alert berjalan tanpa konteks tenant. | User tenant dapat memicu pemindaian shipment/driver lintas tenant; notifikasi juga dibuat tanpa ownership tenant yang tegas. Ini melanggar boundary tenant dan perlu diperbaiki atau endpoint manual dibatasi ke `SUPER_ADMIN`. |
| High if reused | `prisma/seed.js:280-305`, `docs/23agustus.md`, `docs/26agustus06_systemDTMS.md`, `docs/TEST-CREDENTIALS.md` | Password demo dan beberapa secret/key development terdokumentasi atau dibuat oleh seed. | Jika database/secret tersebut pernah dipakai di staging/production atau dokumen dapat diakses publik, attacker dapat login. Rotasi secret dan password segera; seed production harus menolak default credential. |
| Medium | `src/app/api/gps/route.ts:15-42`, `src/app/api/tracking/ingest/route.ts:20-48` | Validasi koordinat GPS tidak memeriksa `finite`, range latitude/longitude, speed, heading, accuracy, battery, dan duplicate/sequence secara konsisten. | Data korup, error database, pemborosan queue/storage, dan telemetry yang tidak dapat dipercaya; bukan bukti langsung privilege escalation. |
| Medium | `src/app/api/tracking/ingest/route.ts:26-45` | Endpoint menerima batch sampai 100 point dan memakai queue fire-and-forget tanpa idempotency key; field `sequence` diterima tetapi tidak digunakan untuk dedup/order. | Retry provider dapat membuat GPS duplikat dan beban berulang. Tambahkan key `(source, device, sequence)` atau hash payload dengan unique constraint. |
| Medium | `src/app/api/system/alerts/route.ts:8-16`, `vercel.json` | Cron bergantung pada `ALERT_CRON_SECRET`, sedangkan `vercel.json` hanya mendefinisikan path/schedule. Jika secret tidak dipasang dengan nama yang tepat, cron akan menerima `401/403`; jika secret bocor, route menerima header statis. | Availability alert dan kontrol akses cron tidak terverifikasi. Konfigurasi secret harus diuji di deployment, dan perbandingan secret sebaiknya constant-time. |
| Low/Medium | `src/middleware.ts:105-131`, `next.config.mjs:13-28` | CSP masih mengizinkan `unsafe-inline`; development juga mengizinkan `unsafe-eval`. | Memperbesar dampak XSS jika ada injection lain. Rencanakan nonce/hash dan uji kompatibilitas Next.js. |

### Hal yang diperiksa dan belum terbukti sebagai celah

- Raw SQL di `tracking/current` dan `gps/latest` memakai parameterized tagged query serta filter tenant pada jalur tenant. Tidak ditemukan SQL injection pada jalur yang dibaca, tetapi semua raw query tetap perlu regression test tenant A/B.
- `$queryRawUnsafe` pada `billing-engine` menggunakan SQL statis dengan parameter tanggal dan berada pada dashboard billing platform. Ini bukan injection berdasarkan kode yang diperiksa, tetapi akses route dan cross-tenant intent harus tetap dibatasi super admin.
- Rate limit memiliki fallback in-memory. Kode mendukung `RATE_LIMIT_REQUIRE_REDIS=true` untuk fail-closed; tanpa konfigurasi itu, perlindungan lintas instance tidak memadai.
- `.env` tidak tracked dan di-ignore oleh Git, tetapi file lokal berisi secret nyata. Jangan membagikan file tersebut; rotasi semua nilai bila pernah terkirim ke chat, log, backup, atau repository.

### Prioritas perbaikan

1. Batasi alert scan manual ke `SUPER_ADMIN`, atau jalankan scan terpisah dalam `runWithTenant` untuk tenant user dan isi `tenantId` pada notification.
2. Rotasi `AUTH_SECRET`, `SUPERADMIN_SECRET_KEY`, credential database, dan credential provider yang pernah digunakan bersama. Hapus secret nyata dari dokumentasi tracked.
3. Tambahkan validasi finite/range dan idempotency pada semua GPS/scan/POD/webhook mutation.
4. Verifikasi `ALERT_CRON_SECRET` pada environment deployment dan tambahkan test untuk request secret valid, invalid, dan kosong.
5. Jalankan ulang test isolation, `npm test`, dan `npm run build` setelah perbaikan.
