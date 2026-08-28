# Laporan Audit & Pemeriksaan Ulang Sistem — DTMS

**Proyek:** DTMS (Delivery & Transport Management System)
**Tanggal pemeriksaan ulang:** 24 Agustus 2026
**Status akhir:** ✅ **SIAP DEPLOY** — tidak ada gap/bug kritis tersisa
**Commit terakhir sebelum laporan ini:** `96f04a0` (+ perbaikan ronde 4, belum di-commit)

---

## 1. Ringkasan Eksekutif

Pemeriksaan ulang menyeluruh dilakukan setelah tiga ronde perbaikan pra-deploy (commit `7a1226c`, `7e3ff36`, `96f04a0`). Hasilnya:

| Aspek | Status |
|---|---|
| Type-check (`tsc --noEmit`) | ✅ Lolos |
| Lint | ✅ Lolos (hanya warning kosmetik: unused imports, hook deps) |
| Build produksi (`next build`) | ✅ Lolos |
| Test suite integrasi + unit | ✅ **306/306 tes, 24 file** — stabil 2× berturut-turut |
| Smoke test live 28 titik (auth, keamanan, CRUD, billing, tracking) | ✅ Lolos semua setelah koreksi |
| Scan residual pola fail-open / celah otorisasi | ✅ Bersih |
| Isolasi antar-tenant (IDOR) | ✅ Terjaga di seluruh endpoint yang diuji |

Selama pemeriksaan ulang ditemukan dan diperbaiki **3 masalah baru** (rincian di Bagian 4).

---

## 2. Riwayat Perbaikan Pra-Deploy

### Ronde 1 — Kritikal Keamanan (commit `7a1226c`)
| ID | Temuan | Perbaikan |
|---|---|---|
| T1 | Tenant admin dapat mengubah plan langganannya sendiri via `PUT /api/tenants/[id]` | Perubahan plan digerbangi khusus `SUPER_ADMIN` |
| T2 | IDOR lintas tenant pada detail/white-label/lifecycle/onboarding/health tenant | Cek kepemilikan `session.tenantId !== id → 403` |
| T3 | Bypass akses file POD untuk `ADMIN_OPERASIONAL` | Hanya `SUPER_ADMIN` yang bypass; fail-closed bila sesi tanpa tenant |
| T4 | `/api/track` publik membocorkan nama lengkap & koordinat GPS | Masking nama, GPS dihapus dari timeline publik, rate-limit 30 req/menit/IP |

### Ronde 2 — Penguatan (commit `7e3ff36`)
| ID | Temuan | Perbaikan |
|---|---|---|
| S1 | Scope API key tidak ditegakkan | Middleware meneruskan method via header `x-dtms-method`; key `read` ditolak untuk mutasi |
| S2 | Account enumeration pada forgot-password & login | Respons seragam + bcrypt compare dummy (`DUMMY_HASH`) untuk penyamaran waktu |
| S3 | `mustChangePassword` bisa dilewati sisi klien | Klaim JWT `mcp`; middleware memblokir mutasi & mengalihkan halaman sampai ganti password |
| S5 | Parsing IP dari `X-Forwarded-For` ambigu | Ambil hop paling kanan (konsisten dengan `security.ts`) |
| S7 | Endpoint posisi armada terbuka untuk role non-operasional | Dibatasi `SUPER_ADMIN`/`ADMIN_OPERASIONAL`/`DISPATCHER` |
| — | Duplikasi konstanta `PLAN_ORDER` (7 lokasi) & `PPN_RATE` 11% (4 lokasi) | Modul tunggal `src/lib/plan-constants.ts` |

### Ronde 3 — Infrastruktur Produksi (commit `96f04a0`)
| Komponen | Perbaikan |
|---|---|
| Job queue GPS | Diganti dari in-memory ke tabel Postgres `JobQueue`: klaim atomik `FOR UPDATE SKIP LOCKED`, retry backoff eksponensial (maks 3 percobaan), pemulihan job yatim >5 menit, pembersihan riwayat. **Terverifikasi bertahan restart server** |
| Rate limiting terdistribusi | Opsional Upstash Redis (`UPSTASH_REDIS_REST_URL/TOKEN`) dengan fallback in-memory |
| Kuota kendaraan | Kolom `maxVehicles` pada Plan & Tenant; ditegakkan saat `POST /api/vehicles`; sinkron saat ganti subscription |

---

## 3. Metodologi Pemeriksaan Ulang

1. **Gerbang kualitas statis**: tsc, lint, build produksi.
2. **Suite pengujian penuh**: 306 tes integrasi+unit terhadap server produksi lokal (`next start`), dijalankan 2× untuk stabilitas.
3. **Smoke test live 28 titik** mencakup:
   - Login multi-role (tenant A, PT Logistik, superadmin), password salah + `remainingAttempts`, lockout brute-force, 401 tanpa sesi.
   - Regresi T1–T4 & S1/S7 pada endpoint nyata.
   - CRUD cycle customers (POST→search→DELETE), list drivers/vehicles/branches/warehouses/hubs/shipments, kuota kendaraan, ringkasan `/api/billing`, `/api/health` (database + queue stats).
   - Isolasi data: seluruh item milik tenant A ber-`tenantId` benar.
4. **Scan residual**: grep pola fail-open (`r.tenantId !== null`, bypass role, duplikasi konstanta) di seluruh `src/`.
5. **Audit basis data dev**: konsistensi referensi & pembersihan polusi data uji.

---

## 4. Temuan Baru Saat Pemeriksaan Ulang (Ronde 4)

### 4.1 🔴 Bug fungsional: pencarian driver tidak bekerja — **DIPERBAIKI**
- **Lokasi:** `src/app/api/drivers/route.ts`
- **Gejala:** Parameter `q` sepenuhnya diabaikan (tidak ada klausa `where`); tes lama lolos hanya karena kebetulan urutan abjad data.
- **Perbaikan:** Filter `name`/`employeeId` case-insensitive untuk `count` & `findMany`. Tes diperbarui membuat fixture sendiri (tidak lagi bergantung data ambient) + kasus baru pencarian by employee ID.

### 4.2 🟡 Celah laten isolasi: record `tenantId = NULL` terlihat lintas tenant — **DIPERBAIKI**
- **Lokasi:** `src/lib/prisma.ts` (extension TENANT_SCOPED, `findUnique`)
- **Gejala:** Verifikasi pasca-query membiarkan lewat record dengan `tenantId` NULL ke konteks tenant mana pun. Saat ini 0 baris NULL di DB, tetapi menjadi lubang laten.
- **Perbaikan:** Fail-closed — record tanpa tenant tidak terlihat dari konteks tenant (superadmin tidak terpengaruh karena tidak difilter).

### 4.3 🟡 Flakiness test suite + polusi DB ekstrem — **DIPERBAIKI**
- **Gejala:** Hasil `npm test` tidak deterministik (kegagalan bergantian antar-run). Akar: (a) 24 file suite berjalan paralel terhadap satu server & DB bersama; (b) DB dev berisi **10.000.099 baris vehicle** buangan loop uji lama sehingga query count/list lambat dan rawan error saat beban.
- **Perbaikan:**
  - `vitest.config.ts`: `fileParallelism: false` — file suite kini berurutan (durasi penuh ±40–60 detik, hasil stabil).
  - DB dibersihkan batch-wise: **9.999.981 vehicle tak-terreferensi dihapus**; 127 vehicle sah dipertahankan/dibuat ulang untuk tenant utama (A, Transportindo 2, Logistik Nusantara).
- **Hasil:** Suite hijau penuh 2× berturut-turut.

### 4.4 Catatan minor (tidak menghalangi deploy)
| Item | Detail | Rekomendasi |
|---|---|---|
| Inkonsistensi bentuk respons list | `drivers/vehicles/customers/shipments` → `{items,total,...}`; `branches/hubs` → array polos | Samakan envelope pada iterasi berikutnya |
| Penolakan scope API key | Key read-only untuk mutasi ditolak **401** (bukan 403). Pemblokiran efektif | Ubah ke 403 agar semantik lebih tepat |
| Validasi foto kendaraan | `POST /api/vehicles` mewajibkan 4 foto — kuota tetap ditegakkan setelah validasi | Pertimbangkan cek kuota sebelum validasi berat |
| Warning lint kosmetik | Unused imports & hook deps di beberapa komponen UI | Bereskan bertahap |

---

## 5. Arsitektur Keamanan (Pasca-Perbaikan)

```
Request
  │
  ├─ middleware.ts ──────────────── CSRF (mutasi) · rate-limit (Redis opsional/in-memory)
  │                                 blokir mutasi saat mcp=true · forward x-dtms-method
  │
  ├─ guardPermission() ──────────── RBAC per permission key
  │
  ├─ Prisma extension (TENANT_SCOPED)
  │     findMany/findFirst/count → where + tenantId (fail-closed)
  │     findUnique              → verifikasi pasca-query (NULL tenant = tolak)
  │     create                  → inject tenantId (TENANT_MISMATCH ditolak)
  │     update/delete           → where + tenantId
  │     write tanpa konteks     → TENANT_CONTEXT_MISSING (fail-closed)
  │
  ├─ checkPlanLimit()/guardPlanLimit() ── kuota users/drivers/shipments/
  │                                        branches/hubs/orgs/storage/vehicles
  └─ verifyApiKey() ─────────────── scope read/write via x-dtms-method
```

**Endpoint publik** (`/api/track`, `/track`): masking nama pribadi, tanpa koordinat, rate-limit per IP.

---

## 6. Status Data & Konfigurasi Dev

| Item | Nilai |
|---|---|
| Plan di DB | 5 plan tersinkron seed kanonis (FREE/STARTER/GROWTH/PRO/ENTERPRISE) dengan harga & limit termasuk `maxVehicles` |
| Vehicle | 127 baris (semua dirujuk relasi atau seed tenant utama) — sebelumnya 10 juta+ |
| Driver | ~1016 baris tenant A (terdapat duplikat historis — tidak berbahaya, hanya data dev) |
| Job queue | `pending=0 running=0 failed=0` (sehat); ketahanan restart terverifikasi |

---

## 7. Checklist Go-Live

### Wajib sebelum deploy produksi
- [x] Seed kini memakai password dari environment dan menolak nilai default di production. Rotasi credential environment tetap wajib.
- [ ] Gunakan **DB produksi fresh**, jalankan migrasi skema + `seed.js` (plans saja bila tidak butuh data dummy).
- [ ] Set env produksi: `AUTH_SECRET`, `SUPERADMIN_SECRET_KEY` (nilai kuat/acak), `APP_URL`, kredensial WhatsApp gateway.
- [ ] (Opsional tapi disarankan multi-instance) Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.
- [ ] Pastikan `.env` tidak ikut ter-deploy (sudah di-gitignore ✓).

### Disarankan
- [ ] Aktifkan backup harian Postgres.
- [ ] Monitoring `/api/health` (uptime + alert `queue.failed > 0`).
- [ ] Index tambahan bila volume shipment besar: evaluasi `Shipment(tenantId, status)`.

### Limitasi diketahui (tidak blocker)
- CSP masih memuat `unsafe-inline` (limitasi default Next.js tanpa nonce — mitigasi: header lain tetap ketat).
- Kuota `regions` & `departments` belum dihitung sebagai resource (tercakup oleh gate fitur `branch_management`).
- Bentuk respons list belum seragam di seluruh modul (lihat 4.4).

---

## 8. Kesimpulan

Seluruh temuan kritikal dan penting dari audit pra-deploy telah diperbaiki dan diverifikasi ulang secara end-to-end. Pemeriksaan menyeluruh menemukan 3 isu tambahan yang juga telah diperbaiki. **Gerbang kualitas hijau penuh (tsc, lint, build, 306/306 tes stabil)**, tidak ditemukan gap atau bug yang menghalangi rilis.

**Rekomendasi:** lanjut ke deployment produksi mengikuti Checklist Bagian 7.

---

## Addendum Round 5 — Audit Aplikasi Driver (24 Agustus 2026)

Verifikasi end-to-end aplikasi driver (`/driver`) dan pemantauan oleh tenant/superadmin menemukan 2 bug nyata yang telah diperbaiki:

### Bug 1: Role DRIVER kehilangan izin laporan harian & GPS
- **Gejala**: `POST /api/driver/daily-report` → 403, `POST /api/gps` → 403 untuk user ber-role DRIVER. Fitur "Laporan Harian" dan kirim posisi GPS di aplikasi driver tidak berfungsi.
- **Penyebab**: `ROLE_PERMS.DRIVER` (src/lib/permissions.ts) dan seed.js tidak memuat `daily_report.read/create` maupun `gps.send`.
- **Perbaikan**: kedua map ditambah `GPS.SEND`, `DAILY_REPORT.READ`, `DAILY_REPORT.CREATE`; sinkronisasi ke DB dijalankan untuk seluruh tenant (30.318 baris RolePermission ditambah).

### Bug 2: Live tracking kosong di server non-UTC (zona waktu)
- **Gejala**: `GET /api/tracking/current` selalu `[]` meski ada GpsLog segar.
- **Penyebab**: kolom DateTime Prisma disimpan sebagai `timestamp` tanpa zona waktu (UTC naif), sedangkan raw SQL membandingkan dengan `NOW()` DB yang sadar-zona-waktu. Di server GMT+7, posisi baru tampak "berumur 7 jam" sehingga terfilter keluar dari jendela 2 jam. Pola sama ada di job queue (`runAfter <= NOW()`, `startedAt = NOW()`).
- **Perbaikan**: cutoff dikirim dari aplikasi sebagai string ISO UTC + cast eksplisit `::timestamp` (src/app/api/tracking/current/route.ts, src/lib/job-queue.ts). Verifikasi: tenant melihat armadanya sendiri; superadmin melihat lintas tenant.

### Catatan kualitas data (belum ditindak)
- Database berisi ±10.106 tenant sisa pengujian lama (10.002 dengan user, 10.000 dengan shipment) dan total >10 juta baris Driver/GpsLog sampah. Superadmin `/api/drivers` menampilkan total >10 juta. Disarankan pembersihan menyeluruh sebelum produksi.

### Hasil verifikasi akhir
| Alur | Status |
|---|---|
| Login driver, lihat tugas, status, kirim GPS | OK |
| Laporan harian driver (lihat + simpan) | OK (setelah fix) |
| Tenant: daftar/detail driver, live tracking | OK |
| Superadmin: semua driver, live tracking lintas tenant | OK |
| Suite integrasi | 306/306 |
