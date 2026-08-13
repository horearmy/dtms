# DTMS — Delivery Tracking & Management System

Sistem manajemen dan pelacakan pengiriman berbasis web (responsive) untuk operasional logistik: manajemen order/shipment, fleet & driver, tracking real-time, proof of delivery (POD), hingga SLA monitoring dan geofencing.

## Fitur

### Core (Phase 1)
- **Autentikasi & RBAC** — 9 peran (Super Admin, Admin Operasional, Dispatcher, Warehouse, Customer Service, Supervisor, Management, Driver, Customer) berbasis JWT cookie.
- **Manajemen Shipment** — CRUD lengkap, nomor resi otomatis `DTMS-YYYYMMDD-000001`, timeline 14 status pengiriman.
- **Penugasan Driver & Kendaraan** — assignment shipment → driver + vehicle.
- **Driver App** — daftar tugas, konfirmasi pickup, POD (tanda tangan digital, foto, koordinat GPS), pelaporan gagal kirim.
- **Live Tracking Map** — peta Leaflet/OpenStreetMap, posisi driver & shipment diperbarui otomatis tiap 15 detik.
- **Tracking Publik** — cek status resi tanpa login, lengkap dengan riwayat perjalanan.
- **Notifikasi, Audit Log, Reports + Ekspor CSV**.

### Phase 2 — Smart Features
- **ETA Otomatis** — estimasi kedatangan dinamis dari jarak (haversine) posisi terakhir ke tujuan.
- **Geofencing** — perimeter area (gudang/hub/wilayah), alert otomatis saat driver masuk/keluar; ditampilkan sebagai layer lingkaran di peta.
- **SLA Monitoring** — deadline otomatis per layanan (Same Day 12 jam, Next Day 24 jam, Regular 96 jam); status On Time / At Risk / Breached di dashboard & halaman resi.
- **Driver Scoring** — skor kinerja kurir (50% penyelesaian + 30% on-time − faktor gagal).
- **Vehicle Telematics** — kecepatan & baterai dari GPS log, telemetri kendaraan aktif.
- **Advanced Analytics** — tren 7 hari, top destinasi, on-time rate.
- **Automated Notification** — alert SLA terlambat & GPS terputus (>30 menit).
- **Integrasi WhatsApp** — tombol "Share status via WhatsApp" di tracking publik.

## Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS v4 |
| Backend | Next.js API Routes (Route Handlers) |
| Database | PostgreSQL 18 + Prisma ORM (migrasi resmi) |
| Auth | JWT (jose), bcryptjs |
| Map | Leaflet + OpenStreetMap |

## Persyaratan

- Node.js ≥ 20 (dikembangkan dengan v24)
- PostgreSQL ≥ 14 (dikembangkan dengan v18)
- Git (opsional)

## Setup

```bash
# 1. Clone
git clone https://github.com/horearmy/dtms.git
cd dtms

# 2. Install dependencies
npm install

# 3. Siapkan environment (buat file .env)
# DATABASE_URL & AUTH_SECRET wajib diisi, contoh:
```

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/dtms"
AUTH_SECRET="ganti-dengan-secret-panjang-acak-anda"
```

```bash
# 4. Migrasi database (jalankan migrasi yang sudah ada)
npm run db:deploy

# 5. (Opsional) Isi data contoh
npm run db:seed

# 6. Jalankan (development)
npm run dev
# atau produksi
npm run build && npm start
```

Aplikasi berjalan di `http://localhost:3000` (jika port dipakai, gunakan `npm run dev -- -p 3001`).

## Akun Demo

| Role | Username | Password |
|---|---|---|
| Super Admin | `superadmin` | `admin123` |
| Admin Operasional | `admin` | `admin123` |
| Dispatcher | `dispatcher` | `admin123` |
| Warehouse | `warehouse` | `admin123` |
| Customer Service | `cs` | `admin123` |
| Supervisor | `supervisor` | `admin123` |
| Manajemen | `management` | `admin123` |
| Driver 1 | `driver1` | `driver123` |
| Driver 2 | `driver2` | `driver123` |

> Ganti password default sebelum digunakan di produksi.

## Script npm

| Script | Fungsi |
|---|---|
| `npm run dev` | Menjalankan dev server |
| `npm run build` | Build produksi |
| `npm start` | Menjalankan hasil build |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Buat & terapkan migrasi baru (development) |
| `npm run db:deploy` | Terapkan migrasi yang ada (produksi) |
| `npm run db:seed` | Isi data contoh |
| `npm run db:reset` | Reset DB + terapkan migrasi + seed |

## Struktur Proyek

```
prisma/
  migrations/          # Riwayat migrasi database
  schema.prisma        # Skema (Shipment, Driver, Geofence, dst.)
  seed.js              # Data contoh
src/
  app/
    (ops)/             # Halaman operasional: dashboard, shipments,
                       #   customers, drivers, vehicles, geofences,
                       #   map, reports, audit
    driver/            # Aplikasi driver (tugas, POD)
    tracking/          # Tracking publik
    api/               # REST API (auth, shipments, gps, geofences, ...)
  components/          # Komponen UI (sidebar, header, peta, signature, ...)
  lib/                 # Helpers (auth, prisma, eta, geofence, alerts, scoring)
  middleware.ts        # Proteksi rute & RBAC
```

## API Ringkasan

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/auth/login` | Login |
| GET/POST | `/api/shipments` | Daftar / buat shipment |
| POST | `/api/shipments/:id/events` | Update status & lokasi |
| POST | `/api/shipments/:id/assign` | Tugaskan driver & kendaraan |
| POST | `/api/shipments/:id/pod` | Simpan bukti penerimaan |
| POST | `/api/gps` | Kirim posisi GPS (deteksi geofence otomatis) |
| GET | `/api/gps/latest` | Posisi terakhir driver & shipment |
| GET/POST | `/api/geofences` | Kelola perimeter area |
| GET | `/api/analytics` | Tren, destinasi, telemetri |
| GET | `/api/tracking/:resi` | Status tracking publik |

## Lisensi

Proyek internal — gunakan dengan bijak. Data kredensial tidak disertakan dalam repository.
