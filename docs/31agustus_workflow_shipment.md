# DTMS — Dokumentasi Pekerjaan 31 Agustus 2026 (Sesi Workflow Shipment + Keamanan)

> **Delivery Tracking Management System (Horearmy DTMS)**
> **Sesi**: Workflow shipment driver (Kartu Jalan), konsolidasi alur gudang, audit keamanan antar-modul
> **Tanggal**: 31 Agustus 2026
> **Commit (di-push ke `origin/main`)**: `544225e`, `533af8a`, `3e4d58b`
> **Branch**: `main` (tersinkron dengan `origin/main`, clean working tree)

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Keputusan Produk (hasil klarifikasi)](#2-keputusan-produk)
3. [Workflow Shipment — Kartu Jalan Driver](#3-workflow-shipment--kartu-jalan-driver)
4. [Alur Gudang — Satu Scan Keberangkatan](#4-alur-gudang--satu-scan-keberangkatan)
5. [Audit Keamanan Antar-Modul (Bug/Gap yang Ditemukan)](#5-audit-keamanan-antar-modul)
6. [Perbaikan Keamanan yang Diterapkan](#6-perbaikan-keamanan-yang-diterapkan)
7. [Perbaikan Dispatch Board](#7-perbaikan-dispatch-board)
8. [Status Verifikasi (typecheck/lint/build/test)](#8-status-verifikasi)
9. [Rute & Otoritas Status (Kunci untuk Sesi Berikutnya)](#9-rute--otoritas-status)
10. [Gap yang MASIH TERBUKA (belum ditangani)](#10-gap-yang-masih-terbuka)
11. [Catatan Operasional & Environment Test](#11-catatan-operasional--environment-test)

---

## 1. Ringkasan Eksekutif

Sesi ini fokus pada **menuntaskan workflow pengiriman (shipment) di sisi driver** sesuai
keputusan pengguna, lalu **audit celah antar-bagian (integration gaps)** dan menutup
temuan keamanan. Ringkasnya:

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Driver home | tumpukan tugas polos | **Kartu Jalan** berwarna per tahap + caption + auto-refresh |
| Verifikasi gudang | beberapa kali scan/ambigu | **Satu scan** untuk semua status pra-berangkat (`PRE_DISPATCH_STATUSES`) |
| Otoritas status | ganda/tidak konsisten | events route → satu jalur resmi; jalur paralel unsafe dinonaktifkan |
| Dispatch board | langsung set `DISPATCHED` (bisa tanpa kendaraan, tanpa cek) | **assign saja**; `DISPATCHED` hanya via scan gudang |
| Isolasi tenant | kebocoran POS/GPS lintas-tenant | `active-positions` di-tenant-scope |
| Admin ops detail | bisa memajukan status sukses | **monitor-only** (boleh GAGAL/RESCHEDULED/RETURN, tak boleh maju) |
| Test suite | 6 gagal (environment) | **323/323 lulus (27 file)** |

Semua perubahan sesi ini sudah **di-commit dan di-push** (3 commit).

---

## 2. Keputusan Produk

Keputusan ini adalah hasil klarifikasi langsung dengan pengguna selama sesi:

1. **Admin hanya memantau** setelah shipment dibuat — TIDAK boleh memajukan status
   sukses (boleh `DELIVERY_FAILED` / `RESCHEDULED` / `RETURN_TO_SENDER`).
2. **"Satu scan cukup untuk semua status pra-berangkat"** — `WAREHOUSE_RECEIVED`,
   `SORTING`, `PICKED_UP` dipandang sebagai satu state "menunggu scan" dari sisi driver.
3. **Tombol tekan-langsung** menjalankan aksi di aplikasi driver; "Selesai = buka form POD".
4. **Kartu Jalan** di halaman utama driver, berwarna per tahap perjalanan, caption di
   samping (font besar/bold), klik "Mulai" langsung mulai perjalanan, **auto-refresh**.
5. **Format QR driver**: `DRV:{employeeId}:SHP:{shipmentId}`.
6. **Dispatch board = assign saja**; status `DISPATCHED` hanya boleh dicapai via scan gudang.

---

## 3. Workflow Shipment — Kartu Jalan Driver

### 3.1 Halaman Utama Driver — `src/app/(driver)/driver/page.tsx`
- Sistem **Kartu Jalan**: `JOURNEY_STEP` (label + bg + note per status), `ADVANCE_STEP`
  (DISPATCHED→IN_TRANSIT→ARRIVED_AT_HUB→OUT_FOR_DELIVERY), `KARTU_CAPTION`.
- Baris Kartu Jalan di atas (horizontal scroll), **caption di samping** (`lg:flex-row`,
  caption `lg:w-72`, tumpuk di mobile).
- Tombol `advanceKartu()` auto-advance via events route + GPS; `advancingId` untuk
  disable saat memproses.
- `OUT_FOR_DELIVERY` → nav ke halaman POD; merah (pra-scan) → pesan "cukup 1x scan gudang".
- **Auto-refresh 20s** via `loadTasks()`.
- Filter tugas konsisten: `ACTIVE_JOURNEY` = 7 status perjalanan; `completedTasks` =
  DELIVERED/RETURNED; `onHoldTasks` = DELIVERY_FAILED/RESCHEDULED/RETURN_TO_SENDER
  (ditampilkan sebagai banner kuning "kiriman sedang ditunda", bukan tugas aktif abu-abu).
- **QR mini** (`ShipmentQR` size≈48) tampil di dalam Kartu Jalan merah saat menunggu scan,
  agar driver langsung bisa menunjukkan QR tanpa buka detail.

### 3.2 Laporan Driver — `src/app/(driver)/driver/laporan/page.tsx`
- Ditulis ulang jadi baris kompak `TaskRow` dengan **satu tombol berwarna dinamis** via
  `actionFor(status)` / `ADVANCE_STEP`:
  - merah pra-scan → hint "Lakukan scan gudang dulu"
  - hijau DISPATCHED → Mulai→IN_TRANSIT
  - kuning → Lapor Tiba di Hub
  - biru → Mulai Antar
  - hijau OUT_FOR_DELIVERY → Selesai→POD nav
- Tombol "Kembali ke Gudang" per card resi selesai, cek GPS, auto-refresh 20s.

### 3.3 Detail Tugas Driver — `src/app/(driver)/driver/tasks/[assignmentId]/page.tsx`
- `NEXT_STEP` DISPATCHED→IN_TRANSIT (diperbaiki: sebelumnya hanya `<Link>` tanpa aksi).
- QR `DRV:...`, form POD, area return/telat.
- Teks QR diubah: "Satu kali scan cukup untuk verifikasi keberangkatan".

### 3.4 Admin Ops Detail — `src/app/(ops)/shipments/[id]/page.tsx`
- Tombol "Lanjut →" dihapus; panel "Status:" + badge + catatan "Admin hanya memantau".
- Dropdown status **difilter** tanpa status forward; variabel `NEXT_STATUS`/`next` dihapus.

---

## 4. Alur Gudang — Satu Scan Keberangkatan

### 4.1 Rute Gudang
- **`/api/warehouse/dispatch-driver`** (baru, driver QR): parse `DRV:{employeeId}:SHP:{id}`,
  menolak status terminal & yang sudah berjalan; `PRE_DISPATCH_STATUSES` =
  `['WAREHOUSE_RECEIVED','SORTING','PICKED_UP']` → `DISPATCHED`. Driver QR harus sama
  dengan driver tertugas; cek kendaraan tidak MAINTENANCE/returning.
- **`/api/shipments/[id]/scan`**: memetakan ORDER_CREATED/PICKUP_SCHEDULED/PICKED_UP→
  WAREHOUSE_RECEIVED; WAREHOUSE_RECEIVED/SORTING→DISPATCHED.

### 4.2 Konsistensi Pesan "Satu Scan"
Pesan di kartu jalan, laporan, dan halaman detail disamakan: "Cukup 1 kali scan gudang
untuk verifikasi keberangkatan". Semua status pra-berangkat menampilkan satu state yang sama.

---

## 5. Audit Keamanan Antar-Modul (Bug/Gap yang Ditemukan)

Review dua arah (lifecycle status + isolasi tenant) menemukan gap nyata:

### 5.1 HIGH — Korban data lintas-tenant
- `src/app/api/shipments/active-positions/route.ts`: `deliveryAssignment` TIDAK di-tenant-scope
  dan tidak difilter → membocorkan shipment aktif + GPS live semua tenant ke siapa pun
  dengan `SHIPMENT.READ` (termasuk DRIVER). Sudah **diperbaiki**.
- `src/app/api/driver/sync/route.ts`: menulis `proofOfDelivery` lintas-tenant tanpa
  validasi shipment/tenant/assignment; `driverId` dari body tanpa ikat session. Sudah
  **dinonaktifkan**.

### 5.2 HIGH — Otoritas status paralel & tidak konsisten
- `/api/driver/sync`: map `DRIVER_FLOW` terbalik (bisa regresi status); bisa DELIVERED
  tanpa POD; target `CANCELLED`/`FAILED` tidak ada di enum. -> **dinonaktifkan**.
- `/api/dispatch`: set DISPATCHED langsung tanpa verifikasi gudang, bisa "tanpa kendaraan",
  tak set `vehicle.status=IN_USE`, tak buat `trackingEvent`, tak cek double-booking, tak
  cek `driver ACTIVE`. -> **diperbaiki** (lih. §7).
- Role **DRIVER** memegang `P.WAREHOUSE.SCAN` → bisa self-dispatch via scan route tanpa QR.
  -> **diperbaiki** (permission dihapus + guard role).

### 5.3 MEDIUM — Lainnya (belum semua ditangani)
- `SORTING` tidak dapat dicapai oleh alur mana pun namun direferensikan banyak tempat
  (status "mati").
- Tidak ada jalur pelaporan kegagalan dari sisi driver (DELIVERY_FAILED) — hanya ops.
- `events/scan/dispatch-driver` membuat trackingEvent lalu update status **non-transaksional**
  (beda dengan `pod/route.ts` yang memakai `$transaction`).
- Notifikasi/WhatsApp/`warehouseScan` side-effect tidak seragam lintas rute.
- Branch scoping (`branchId`) bersifat decorative — tidak pernah diterapkan.

---

## 6. Perbaikan Keamanan yang Diterapkan

**Commit `533af8a`** `fix(security): scope active-positions by tenant, block driver self-dispatch, disable driver sync`:
1. `active-positions/route.ts`: filter `shipment.tenantId` (relasi `deliveryAssignment`);
   SUPER_ADMIN (`tenantId=null`) tetap global.
2. `permissions.ts`: hapus `P.WAREHOUSE.SCAN` dari role DRIVER.
   `src/app/api/shipments/[id]/scan/route.ts`: guard eksplisit `role === 'DRIVER' → 403`.
3. `driver/sync/route.ts`: POST di-decommission → `410` dengan pesan mengarah ke
   events/POD. (Tidak ada frontend/test yang memanggilnya — diverifikasi via grep.)

---

## 7. Perbaikan Dispatch Board

**Commit `3e4d58b`** `fix(dispatch): assign-only via dispatch board, DISPATCHED gated by warehouse scan`:
- `src/app/api/dispatch/route.ts` POST: kini **assign murni** (setara `assign/route.ts`):
  - `vehicleId` **wajib** (tidak ada lagi DISPATCHED tanpa kendaraan),
  - cek on-road double-booking driver & kendaraan (`ON_ROAD_STATUSES`), MAINTENANCE,
    returning, **driver ACTIVE**,
  - **TIDAK** set `DISPATCHED`/`IN_USE` — status hanya maju via scan gudang,
  - kirim WhatsApp + SSE + audit.
- GET: `activeAssignments` kini mencakup penugasan pra-dispatch (WAREHOUSE_RECEIVED/
  SORTING/ORDER_CREATED) + on-road, agar penugasan yang belum scan tetap terlihat.
- `src/app/(ops)/dispatch/DispatchBoard.tsx`: kendaraan wajib (guard + opsi "Pilih
  Kendaraan"), header "Penugasan & Dispatch Aktif".

---

## 8. Status Verifikasi

```
npm run typecheck : 0 error
npm run lint      : 0 error
npm run build     : sukses (178 halaman statis)
npm test          : 323/323 lulus (27 file)
Smoke runtime     : /login → 200 (server next start)
git               : 3 commit di-push (544225e, 533af8a, 3e4d58b) → tersinkron origin/main
```

**Catatan penting untuk menjalankan test**:
- Server production `next start` di `localhost:3000` membaca `RATE_LOGIN_LIMIT` saat
  startup. `.env` berisi **dua** baris `RATE_LOGIN_LIMIT` (100 lalu 10 — nilai terakhir
  menang). Bila suite integrasi gagal dengan 429 "Terlalu banyak permintaan", ini bukan
  regresi: bucket Redis `login:{ip}` habis.
- Cara benar: restart server dengan `$env:RATE_LOGIN_LIMIT='9999'` SEBELUM men-start server
  (bukan hanya di proses vitest), lalu jalankan `npm test`.
- Test integrasi berbagi satu server & DB; `vitest.config.ts` memakai `fileParallelism:false`.

---

## 9. Rute & Otoritas Status (Kunci untuk Sesi Berikutnya)

| Rute | Status yang diizinkan | Guard | trackingEvent? |
|---|---|---|---|
| `shipments/[id]/events` | DRIVER_FLOW: DISPATCHED→IN_TRANSIT→ARRIVED_AT_HUB→OUT_FOR_DELIVERY; DELIVERED/forward non-driver diblokir; admin boleh DELIVERY_FAILED/RESCHEDULED/RETURN_TO_SENDER | `SHIPMENT.UPDATE` + role/assignment | ya |
| `shipments/[id]/scan` | WAREHOUSE_FLOW → WAREHOUSE_RECEIVED / DISPATCHED | `WAREHOUSE.SCAN` + **bukan DRIVER** | ya |
| `warehouse/dispatch-driver` | PRE_DISPATCH → DISPATCHED (satu scan QR) | `WAREHOUSE.SCAN` | ya |
| `shipments/[id]/pod` | OUT_FOR_DELIVERY→DELIVERED | DRIVER + assignment | ya ($transaction) |
| `shipments/[id]/assign` | membuat assignment, **tanpa** ubah status | `SHIPMENT.ASSIGN` | tidak |
| `dispatch` (board) | membuat assignment, **tanpa** ubah status | `DISPATCH.ASSIGN` | tidak |
| `driver/tasks` GET | baca tugas | DRIVER + tenant | — |
| `driver/tasks` POST | **410 decommission** | — | — |
| `driver/sync` POST | **410 decommission** | — | — |

**Jalur resmi**: scan gudang (QR) → DISPATCHED; events route → kemajuan perjalanan;
pod route → DELIVERED. `trackingEvent` adalah unit audit utama.

---

## 10. Gap yang MASIH TERBUKA (belum ditangani)

Jika sesi berikutnya melanjutkan, prioritas yang direkomendasikan:

1. **MEDIUM — `SORTING` status mati**: tidak ada rute yang memasukkannya, padahal banyak
   bagian mereferensikannya. Putuskan: hapus dari enum/logika atau buat rute masuknya.
2. **MEDIUM — jalur kegagalan driver**: driver tidak punya cara melaporkan
   `DELIVERY_FAILED` di aplikasi (hanya ops). Tambahkan aksi "Gagal/Tunda" di sisi driver
   (events route saat ini menolak DELIVERY_FAILED utk driver).
3. **MEDIUM — non-transaksional pada events/scan/dispatch-driver**: `trackingEvent.create`
   sebelum `shipment.update` tanpa `$transaction` (peluang event yatim/status-missing saat
   error). Samakan dengan pendekatan `pod/route.ts`.
4. **MEDIUM — side-effect tidak seragam**: WhatsApp/notifikasi/`warehouseScan` tidak
   konsisten lintas rute perubah status.
5. **LOW/MEDIUM — branch scoping decorative**: `branchId` tidak pernah diterapkan pada
   query shipment/assignment. Kalau per-branch intended, perlu diterapkan.
6. **LOW — redundancy/POD**: `assign/route.ts` (halaman detail) dan `dispatch/route.ts`
   (board) kini mirip; bisa dipertimbangkan pemusatan.

---

## 11. Catatan Operasional & Environment Test

- **API keys/format**: QR driver `DRV:{employeeId}:SHP:{shipmentId}`.
- **Environment test**: `RATE_LOGIN_LIMIT=9999` saat menjalankan suite (lihat §8).
- **DB**: JANGAN `prisma migrate dev/reset` pada DB produksi (±10.000 tenant);
  gunakan `db execute` + folder migrasi manual + `migrate resolve`.
- **`.opencode/` TIDAK dilacak git** (berisi node_modules lokal + skill definitions).
- **ISU lint**: hanya `<img>` warning (`@next/next/no-img-element`) yang pre-existing.

---

*Dokumen ini dimaksudkan sebagai titik awal lanjutan sesi berikutnya; periksa §10 "Gap yang MASIH TERBUKA" untuk pekerjaan lanjutan.*
