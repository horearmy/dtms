# DTMS — Dokumentasi Pekerjaan 24 Agustus 2026

> **Delivery Tracking Management System**
> **Sesi**: Normalisasi penuh (review → fix → verifikasi → rilis)
> **Tanggal**: 24 Agustus 2026 | **Commit**: `be3f502` (pushed ke `origin/main`)

---

## Daftar Isi

1. [Ringkasan Sesi](#1-ringkasan-sesi)
2. [Perubahan Schema & Migrasi](#2-perubahan-schema--migrasi)
3. [Perbaikan Bug](#3-perbaikan-bug)
4. [Penguatan Keamanan](#4-penguatan-keamanan)
5. [Penyelarasan Test Suite](#5-penyelarasan-test-suite)
6. [Status Verifikasi Akhir](#6-status-verifikasi-akhir)
7. [Mekanisme Login Superadmin](#7-mekanisme-login-superadmin)
8. [Kredensial & Environment Test](#8-kredensial--environment-test)
9. [Catatan Operasional](#9-catatan-operasional)

---

## 1. Ringkasan Sesi

Sesi ini menuntaskan sisa pekerjaan normalisasi pasca-rename field relasi Prisma
(PascalCase → camelCase) dan memastikan seluruh pipeline kualitas hijau:

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Typecheck (`tsc --noEmit`) | 228 error | **0 error** |
| Build produksi | gagal (ignoreBuildErrors aktif) | **sukses** |
| Test suite | banyak gagal | **305/305 lulus (24/24 file)** |
| Lint (`eslint .`) | 11 error | **0 error** (73 warning by design) |
| Smoke test runtime | sebagian 500 | **semua endpoint utama 200** |

Semua perubahan dikomit dalam `be3f502` dan di-push ke GitHub.

---

## 2. Perubahan Schema & Migrasi

### 2.1 POD menjadi One-to-Many

`Shipment.pods` berubah dari relasi opsional tunggal (`ProofOfDelivery?`)
menjadi daftar (`ProofOfDelivery[]`). Semua konsumen kode sudah konsisten
mengakses via `shipment.pods[0]`.

Konsekuensi teknis:
- Tidak ada lagi `upsert where { shipmentId }` pada `ProofOfDelivery`;
  diganti `create` di:
  - `src/app/api/shipments/[id]/pod/route.ts`
  - `src/app/api/driver/sync/route.ts`
- Index unik lama dihapus.

### 2.2 Migrasi Manual (penting!)

Riwayat migrasi Prisma **tidak sinkron** dengan database yang dikelola
`prisma db push`. Karena database produksi berisi ±10.000 tenant nyata,
**JANGAN menjalankan `prisma migrate dev` atau `prisma migrate reset`**
(keduanya akan meminta RESET data).

Migrasi diterapkan manual:
1. Eksekusi langsung: `DROP INDEX IF EXISTS "ProofOfDelivery_shipmentId_key";`
   (via `prisma db execute`)
2. Folder migrasi dibuat manual: `prisma/migrations/20260823120000_pod_allow_multiple/migration.sql`
3. Ditandai terpakai: `prisma migrate resolve --applied 20260823120000_pod_allow_multiple`

Status akhir: `prisma migrate diff` kosong — **schema ↔ database sinkron**.

---

## 3. Perbaikan Bug

### 3.1 Korupsi Envelope Respons (paling banyak)

Codemod rename sempat merusak key respons API dari camelCase ke PascalCase.
Yang ditemukan dan diperbaiki:

| File | Salah | Benar |
|---|---|---|
| `src/app/api/drivers/[id]/route.ts` | `Driver:` | `driver:` |
| `src/app/api/driver/status/route.ts` | `Driver:` | `driver:` |
| `src/app/api/gps/return-timeline/route.ts` | `Driver:` | `driver:` |
| `src/app/api/auth/me/route.ts` | `User:` | `user:` |

Dampak nyata: halaman profile/password client membaca `.user` sehingga selalu
undefined; komponen ReturnTimeline membaca `.driver`.

### 3.2 Include Relasi Lama

- `src/app/api/notifications/route.ts`: nested include `Shipment:` →
  `shipment:` (dengan filter `assignments.some.driver.userId`) — penyebab 500
  pada dashboard notifications.
- `src/lib/alerts.ts`, berbagai route: akses `receiver.name`,
  `_count.customers/geofences/hubs`, `subscription.plan`, dsb.

### 3.3 Search Shipments 500

`src/app/api/shipments/route.ts` masih memakai nama relasi implisit Prisma lama
(`Customer_Shipment_senderIdToCustomer`) pada klausa pencarian `q` →
`PrismaClientValidationError`. Diganti ke `{ sender: { is: { name: ... } } }`
dan `{ receiver: { is: { name: ... } } }`.

### 3.4 auditLog Fail-Closed Memblokir Login Gagal

Hook write fail-closed menganggap `auditLog` tenant-scoped; login GAGAL (tanpa
konteks tenant) melempar `TENANT_CONTEXT_MISSING` sehingga endpoint login
menjawab 500 alih-alih 401.

Solusi (`src/lib/prisma.ts`):
```ts
const FAIL_CLOSED_EXEMPT = new Set(['auditLog']);
```

### 3.5 Middleware Menolak Sesi Superadmin

Middleware hanya mengenali cookie `dtms_token`, sehingga SA (cookie
`dtms_sa_token`) selalu di-redirect ke /login. Perbaikan (`src/middleware.ts`
± baris 160):

```ts
const token = req.cookies.get(COOKIE_NAME)?.value
           ?? req.cookies.get('dtms_sa_token')?.value;
```

### 3.6 SQL Tracking Current

`/api/tracking/current` ditulis ulang dengan JOIN eksplisit agar filter tenant
benar:
```sql
JOIN "Driver" d ON d."id" = g."driverId" ... AND d."tenantId" = ...
```

---

## 4. Penguatan Keamanan

| Item | Detail |
|---|---|
| Fallback secret dihapus | `'DTMS-SEC-2026-XK9!mPz#vR'` tidak ada lagi di `superadmin-auth.ts`; tanpa env `SUPERADMIN_SECRET_KEY` semua upaya ditolak (fail-closed) |
| XFF anti-spoof | `getClientIp` & `getClientIpSa` kini mengambil **hop paling kanan** dari `X-Forwarded-For` (IP proxy tepercaya), bukan hop pertama yang bisa dipalsukan klien |
| Fingerprint sesi SA | `getSession()` memverifikasi fingerprint (`sha256(ip:user-agent)`) setiap request; cookie curian dari browser/IP lain ditolak |
| Logout menyeluruh | `/api/auth/logout` menghapus **kedua** cookie (`dtms_token` + `dtms_sa_token`) |
| Rate limit reset password | `checkRateLimit('reset-pw:'+ip, 10, 3600_000)` ditambahkan |
| Forgot password | Pesan generik (tanpa user enumeration) — sudah ada, diverifikasi |
| ignoreBuildErrors | Dihapus dari `next.config.mjs`; build kini menggagalkan error TypeScript |

---

## 5. Penyelarasan Test Suite

21 kegagalan awal ditriase menjadi beberapa kategori:

### 5.1 Ekspektasi test diperbarui (perilaku baru lebih benar)
- **List tenant SA ≥10K**: `/api/tenants` memang dipaginasi (`take: pageSize`,
  maks 100). Test kini memverifikasi field `total` ≥ 10000 — berlaku di
  `isolation-rbac.test.ts`, `functional-and-isolation.test.ts`,
  `tenants.test.ts`.
- **Tenant admin tidak boleh list semua tenant**: guard SA-only adalah perilaku
  benar (mencegah kebocoran info lintas tenant); test dibalik menjadi ekspektasi
  401/403.
- **XFF**: test IP diperbarui ke hop paling kanan.
- **Password superadmin**: DB memakai `Admin1234` (bukan `admin123`);
  `global-setup.ts` kini membaca `TEST_SA_PASSWORD || 'Admin1234'` dan test
  auth mengikuti.

### 5.2 Mock unit test disesuaikan ke schema baru
- `resi.route.test.ts`: mock `sender:`/`receiver:` (sebelumnya
  `Customer_Shipment_*ToCustomer`).
- `alerts.test.ts`: mock shipment diberi `receiver: { name }`.
- `me.route.test.ts`: lolos otomatis setelah envelope `user:` diperbaiki.

---

## 6. Status Verifikasi Akhir

```
tsc --noEmit      : 0 error
next build        : sukses (57 halaman)
vitest run        : 305/305 lulus (24 file)
eslint .          : 0 error, 73 warning (by design)
Smoke runtime     : login ✓ /api/auth/me ✓ search ✓ tracking ✓
                    dashboard/shipments/tracking/track ✓
                    SA step1+step2 ✓ /tenants ✓ logout hapus 2 cookie ✓
                    IDOR lintas tenant 404 cepat ✓ rate-limit 429 ✓
git               : be3f502 committed & pushed (51 file, +2810/−604)
```

---

## 7. Mekanisme Login Superadmin

Halaman: `/admin/secure-login` · API: `POST /api/auth/superadmin-login`

### Step 1 — Secret Key
```
{ "step": 1, "secretKey": "<SUPERADMIN_SECRET_KEY>" }
```
1. Whitelist IP (`SUPERADMIN_ALLOWED_IPS`; kosong = semua, localhost selalu boleh).
2. Rate limit ketat: **3 gagal / 15 menit per IP** → 429 + `retryAfter`.
3. Bandingkan secret dengan `crypto.timingSafeEqual`; env kosong = tolak semua.
4. Sukses → JWT sementara `purpose=sa_step1`, kedaluwarsa **5 menit**
   (dikembalikan sebagai body, bukan cookie).

### Step 2 — Kredensial
```
{ "step": 2, "sessionToken": "...", "username": "superadmin", "password": "..." }
```
1. Verifikasi token step 1.
2. User harus `tenantId=null` + `role=SUPER_ADMIN` + `status=ACTIVE`.
3. `bcrypt.compare` password.
4. Sukses → cookie **`dtms_sa_token`**: HS256, httpOnly, sameSite strict,
   secure di produksi, masa aktif **4 jam**, berisi identitas + `pwdVersion`
   + fingerprint.

### Selama Sesi
- Setiap request: fingerprint dicocokkan ulang dengan header (anti pencurian cookie).
- Middleware menerima `dtms_sa_token` untuk halaman admin global.
- Audit log lengkap: `SUPERADMIN_SECRET_FAILED/OK`, `SUPERADMIN_LOGIN_FAILED/SUCCESS`.

---

## 8. Kredensial & Environment Test

> Hanya untuk lingkungan development/test lokal.

| Akun | Username | Password |
|---|---|---|
| Tenant A | `admin00001` | `admin123` (tenantId `357011aa-...`) |
| Tenant B | `admin00002` | `admin123` (tenantId `f7f63209-...`) |
| Superadmin | `superadmin` | `Admin1234` (+ secret key dari env) |

- `global-setup.ts` mendukung override: `TEST_SA_PASSWORD`.
- Nilai `.env` ditulis berkutip (`KEY="value"`); dotenv mengupas kutip saat load,
  skrip yang membaca file mentah harus mengupas sendiri.

---

## 9. Catatan Operasional

- **Jangan jalankan `prisma migrate dev/reset`** terhadap DB ini (lihat §2.2);
  gunakan `db execute` + folder migrasi manual + `migrate resolve`.
- Artefak kerja sesi (`test-output.txt`, `fail-detail.txt`, `tsc-errors.txt`,
  `relmap.txt`, `temp-testsprite-runner.js`) telah dibersihkan dari repo.
- Skrip codemod satu kali disimpan di `scripts/` untuk jejak audit
  (`fix-*-casing.js`, `revert-*.js`, `seed-10k-drivers.ts`).
- Sisa warning lint (73) umumnya `no-explicit-any` / unused vars yang sengaja
  dipasang sebagai warning — bukan prioritas.

