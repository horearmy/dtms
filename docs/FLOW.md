# DTMS — Alur Aplikasi & Arsitektur Enterprise

> Delivery Tracking Management System — Dokumentasi Lengkap

---

## Daftar Isi

1. [Arsitektur Multi-Tenancy](#1-arsitektur-multi-tenancy)
2. [Autentikasi & Otorisasi](#2-autentikasi--otorisasi)
3. [Alur Pengiriman (Core Flow)](#3-alur-pengiriman-core-flow)
4. [Alur Driver (Mobile App)](#4-alur-driver-mobile-app)
5. [Live Tracking Map](#5-live-tracking-map)
6. [Sistem Notifikasi](#6-sistem-notifikasi)
7. [Manajemen Master Data](#7-manajemen-master-data)
8. [Reporting & Analitik](#8-reporting--analitik)
9. [Warehouse Operations](#9-warehouse-operations)
10. [Integrasi Eksternal](#10-integrasi-eksternal)
11. [Data Model & Relasi](#11-data-model--relasi)
12. [API Reference](#12-api-reference)
13. [Rekomendasi Enterprise Upgrade](#13-rekomendasi-enterprise-upgrade)

---

## 1. Arsitektur Multi-Tenancy

### Struktur Hierarki

```
Platform (SUPER_ADMIN)
  └── Tenant (Perusahaan)
       ├── Users (Staff internal)
       ├── Drivers (Kurir)
       ├── Vehicles (Armada)
       ├── Customers (Pelanggan)
       ├── Shipments (Pengiriman)
       └── Geofences (Zona operasional)
```

### Model Tenant

| Field | Tipe | Keterangan |
|---|---|---|
| `name` | String | Nama perusahaan |
| `slug` | String (unique) | Identifier URL |
| `plan` | String | FREE / PREMIUM |
| `maxUsers` | Int | Batas jumlah user (default: 5) |
| `maxDrivers` | Int | Batas jumlah driver (default: 10) |
| `maxShipments` | Int | Batas jumlah pengiriman (default: 100) |
| `active` | Boolean | Status aktif/tidak |
| `logoUrl` | String? | Logo custom |
| `faviconUrl` | String? | Favicon custom |
| `primaryColor` | String | Warna utama (default: #2563eb) |
| `secondaryColor` | String | Warna sekunder |
| `accentColor` | String | Warna aksen |
| `domain` | String? | Custom domain |

### Tenant Scoping (Otomatis)

Prisma extension di `src/lib/prisma.ts` otomatis inject `tenantId` ke setiap query untuk model yang terdaftar di `TENANT_SCOPED`. Menggunakan `AsyncLocalStorage` untuk tenant context per request.

**Model yang di-scoping:**
`user`, `customer`, `shipment`, `shipmentStop`, `shipmentItem`, `driver`, `vehicle`, `vehicleMaintenance`, `dailyReport`, `trackingEvent`, `proofOfDelivery`

**Model yang TIDAK di-scoping:**
`deliveryAssignment`, `gpsLog` (terisolasi lewat relasi ke Shipment/Driver/Vehicle)

---

## 2. Autentikasi & Otorisasi

### Login Flow

```
┌─────────────┐
│  /login     │
│  Pilih      │
│  Tenant     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Username + │     POST /api/auth/login
│  Password   │──────────────────────────┐
└─────────────┘                          │
                                         ▼
                                  ┌──────────────┐
                                  │ Rate Limit   │ 10 login/menit per IP
                                  │ Cek          │ (in-memory + Redis)
                                  └──────┬───────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │ Validasi     │
                                  │ Tenant       │  Cek tenant.active
                                  │ + User       │  Cek user.status = ACTIVE
                                  └──────┬───────┘  bcrypt.compare
                                         │
                            ┌────────────┴────────────┐
                            │                         │
                            ▼                         ▼
                     ┌────────────┐          ┌──────────────┐
                     │ TOTP       │          │ Langsung     │
                     │ Required?  │          │ Set Session  │
                     └─────┬──────┘          └──────┬───────┘
                           │                        │
                           ▼                        │
                    ┌────────────┐                   │
                    │ /login?    │                   │
                    │ twoFactor  │                   │
                    │ Token=xxx  │                   │
                    └─────┬──────┘                   │
                          │                          │
                          ▼                          │
                   ┌────────────┐                    │
                   │ Input OTP  │  POST /api/auth/two-factor
                   └─────┬──────┘                    │
                         │                           │
                         ▼                           │
                  ┌────────────┐                     │
                  │ Set Session│◄────────────────────┘
                  └─────┬──────┘
                        │
                        ▼
                 ┌──────────────┐
                 │ Redirect     │
                 │ sesuai Role  │
                 └──────────────┘

SUPER_ADMIN      → /tenants
DRIVER           → /driver
Lainnya          → /dashboard
Password Baru    → /account/password?first=1
```

### Sistem Role (9 Level)

| Role | Label | Akses Utama |
|---|---|---|
| `SUPER_ADMIN` | Super Admin | Kelola tenant, demo request, audit log |
| `ADMIN_OPERASIONAL` | Admin Operasional | Semua fitur operasional + kelola user |
| `DISPATCHER` | Dispatcher | Pengiriman, kurir, kendaraan, live map |
| `WAREHOUSE` | Warehouse | Scan gudang |
| `SUPERVISOR` | Supervisor | Dashboard, laporan, driver |
| `MANAGEMENT` | Management | Dashboard, analitik, laporan |
| `CUSTOMER_SERVICE` | Customer Service | Tracking, notifikasi |
| `DRIVER` | Driver/Kurir | App driver (route terpisah) |
| `CUSTOMER` | Customer | Tracking publik |

### Fitur Keamanan

- **JWT Token** — 12 jam expiry (configurable via `SESSION_HOURS`)
- **TOTP 2FA** — Google Authenticator compatible + backup codes
- **Password Policy** — `mustChangePassword` untuk first login
- **pwdVersion** — Force logout semua session saat password diubah
- **Rate Limiting** — API: 300/menit, Login: 10/menit per IP
- **Login Attempt Tracking** — Blokir setelah percobaan gagal
- **Audit Logging** — Setiap aksi dicatat: user, IP, user agent, timestamp
- **Google SSO** — Login alternatif via OAuth 2.0

---

## 3. Alur Pengiriman (Core Flow)

### Status Flow

```
ORDER_CREATED ────────────────────────────────────────┐
  │                                                    │
  │  • Generate tracking number: DTMS-YYYYMMDD-XXXXX  │
  │  • Input: sender, receiver, items, lokasi          │
  │  • Hitung SLA deadline:                            │
  │    - SAME_DAY: 12 jam                              │
  │    - NEXT_DAY: 24 jam                              │
  │    - REGULAR: 96 jam (4 hari)                      │
  │  • WhatsApp notif ke penerima                      │
  ▼                                                    │
WAREHOUSE_RECEIVED                                     │
  │  • Warehouse scan (masuk gudang)                   │
  │  • Update via /api/shipments/[id]/scan             │
  ▼                                                    │
DISPATCHED ◄──────── Assign Driver + Vehicle ─────────┘
  │  • POST /api/shipments/[id]/assign                 │
  │  • Buat DeliveryAssignment                         │
  │  • WhatsApp: "Barang diberangkatkan"               │
  ▼                                                    │
IN_TRANSIT                                             │
  │  • Driver kirim GPS log berkala (real-time)         │
  │  • Geofence check otomatis (enter/exit area)        │
  ▼                                                    │
ARRIVED_AT_HUB                                         │
  │  • Scan di hub tujuan                              │
  ▼                                                    │
OUT_FOR_DELIVERY                                       │
  │  • Driver ambil barang, mulai antar                │
  │  • GPS tracking aktif                              │
  ▼                                                    │
DELIVERED ◄──────────── Proof of Delivery ─────────────┘
  │  • POST /api/shipments/[id]/pod                    │
  │  • Nama penerima + tanda tangan + foto             │
  │  • WhatsApp: "Barang berhasil diterima"            │
  │  • Update totalDistanceKm kendaraan                │
  ▼
DONE ✓
```

### Status Alternatif (Gagal)

```
OUT_FOR_DELIVERY
  │
  ├──► DELIVERY_FAILED
  │      │  Alasan:
  │      │  • Penerima tidak berada di lokasi
  │      │  • Alamat tidak ditemukan
  │      │  • Penerima menolak
  │      │  • Nomor telepon tidak aktif
  │      │  • Akses lokasi tidak memungkinkan
  │      │  • Barang rusak
  │      │  • Kondisi lainnya
  │      │
  │      ├──► RESCHEDULED ──► OUT_FOR_DELIVERY (coba lagi)
  │      │
  │      └──► RETURN_TO_SENDER ──► RETURNED
  │
  └──► RETURN_TO_SENDER ──► RETURNED
```

### Tracking Number Format

```
DTMS-YYYYMMDD-XXXXXX
│     │         │
│     │         └── 6 digit random (100000-999999)
│     └── Tanggal pembuatan
└── Prefix tetap
```

### Service Type & SLA

| Service Type | SLA | Label |
|---|---|---|
| `SAME_DAY` | 12 jam | Same Day (< 12 jam) |
| `NEXT_DAY` | 24 jam | Next Day (< 24 jam) |
| `REGULAR` | 96 jam | Regular (2-4 hari) |

---

## 4. Alur Driver (Mobile App)

### Route Structure

```
/driver                    — Dashboard driver
/driver/tasks              — Daftar tugas
/driver/tasks/[id]         — Detail tugas
/driver/laporan            — Laporan harian
```

### Flow Tugas Driver

```
Driver Login (role: DRIVER)
  │
  ▼
/driver (Dashboard)
  │  • Jumlah tugas hari ini
  │  • Status kendaraan
  │  • GPS status
  │
  ├──► /driver/tasks (Daftar Tugas)
  │      │
  │      │  GET /api/driver/tasks
  │      │  → Filter: assignment milik driver ini
  │      │  → Include: shipment, vehicle
  │      │
  │      ▼
  │    /driver/tasks/[assignmentId] (Detail)
  │      │
  │      ├── Mulai Perjalanan
  │      │     POST /api/driver/status
  │      │     → shipment status → IN_TRANSIT
  │      │
  │      ├── GPS Sender (otomatis)
  │      │     POST /api/gps
  │      │     → Kirim: lat, lng, speed, heading, accuracy, battery
  │      │     → Geofence check otomatis
  │      │
  │      ├── Tiba di Tujuan
  │      │     POST /api/shipments/[id]/events
  │      │     → shipment status → OUT_FOR_DELIVERY
  │      │
  │      ├── Selesaikan (POD)
  │      │     POST /api/shipments/[id]/pod
  │      │     → receiverName, signature, photo, notes
  │      │     → shipment status → DELIVERED
  │      │     → WhatsApp notif ke customer
  │      │
  │      └── Gagal
  │            POST /api/shipments/[id]/events
  │            → status: DELIVERY_FAILED
  │            → alasan + foto bukti
  │
  ├──► /driver/laporan (Laporan Harian)
  │      POST /api/driver/daily-report
  │      → deliveredCount, failedCount, rescheduledCount
  │      → fuelLiter, notes
  │
  ├──► Return to Base
  │      POST /api/driver/return
  │      → driver.returning = true
  │      → driver.returnStartedAt = now
  │
  └──► Status Update
         POST /api/driver/status
         → returning, returnStartedAt
```

### GPS Log Fields

| Field | Tipe | Keterangan |
|---|---|---|
| `latitude` | Float | Latitude posisi |
| `longitude` | Float | Longitude posisi |
| `speed` | Float? | Kecepatan (km/h) |
| `heading` | Float? | Arah (derajat) |
| `accuracy` | Float? | Akurasi GPS (meter) |
| `battery` | Float? | Level baterai (%) |

---

## 5. Live Tracking Map

### Endpoint

```
GET /api/gps/latest?minutes=120
```

### Data yang Dikembalikan

```json
{
  "drivers": [
    {
      "driverId": "xxx",
      "name": "Budi",
      "photo": "url",
      "vehicleNumber": "B 1234 CD",
      "latitude": -6.2088,
      "longitude": 106.8456,
      "speed": 45.2,
      "heading": 180,
      "accuracy": 10,
      "battery": 85,
      "returning": false,
      "returnedAt": null,
      "warehouseName": "Gudang Jakarta",
      "warehouseLat": -6.21,
      "warehouseLng": 106.84,
      "updatedAt": "2026-08-18T10:00:00Z"
    }
  ],
  "shipments": [
    {
      "id": "xxx",
      "trackingNumber": "DTMS-20260818-123456",
      "status": "IN_TRANSIT",
      "destination": "Bandung",
      "origin": "Jakarta",
      "driver": "Budi",
      "vehicle": "B 1234 CD",
      "originLat": -6.21,
      "originLng": 106.84,
      "destLat": -6.92,
      "destLng": 107.62,
      "stops": [
        { "seq": 1, "label": "Stop 1", "latitude": -6.59, "longitude": 106.80 }
      ]
    }
  ]
}
```

### Fitur Peta

- **Marker Driver** — Posisi real-time setiap driver
- **Marker Shipment** — Asal → Tujuan + multi-stop
- **Geofence Overlay** — Warehouse, Hub, Area Operasional
- **Return Timeline** — Rute kembali driver ke gudang
- **Auto-refresh** — Polling setiap beberapa detik

### Geofence Check

```
Driver kirim GPS → checkGeofences()
  │
  ├── Hitung jarak (haversine) ke setiap geofence aktif
  │
  ├── Jarak <= radius & status terakhir = EXIT
  │     → Buat GeofenceEvent (ENTER)
  │     → Buat Notification: "Driver masuk area: [nama]"
  │
  └── Jarak > radius & status terakhir = ENTER
        → Buat GeofenceEvent (EXIT)
```

---

## 6. Sistem Notifikasi

### Tipe Notifikasi

#### In-App (Database)

| Event | Trigger | Message |
|---|---|---|
| SLA Breach | `scripts/alert-scheduler.js` | "SLA Terlambat: [trackingNumber] — [receiver] melewati deadline" |
| GPS Disconnect | `scripts/alert-scheduler.js` | "GPS Driver Terputus: [driverName] — posisi terakhir X menit lalu" |
| Geofence Enter | `src/lib/geofence.ts` | "Driver masuk area: [geofenceName] — [driverName] masuk perimeter" |
| Demo Request | `api/demo-request/route.ts` | "Permohonan Demo baru dari [name] ([company])" |

#### WhatsApp (External API)

| Event | Template |
|---|---|
| Status Update | Pesanan Anda telah diterima/diambil/diberangkatkan/dll. |
| SLA Breach | Alert ke admin: shipment terlambat |
| GPS Disconnect | Alert ke admin: GPS driver terputus |
| Delivery Failed | Notif ke customer: pengiriman gagal |

#### Alert Scheduler

```bash
# Run sekali
npm run alerts:run

# Run sebagai daemon
npm run alerts:scheduler
```

**Logika:**
1. Cek semua shipment dengan `slaDeadline` yang sudah lewat
2. Cek semua driver `ACTIVE` dengan GPS stale > 30 menit
3. Buat notification jika belum ada (dedup)
4. Kirim WhatsApp jika enabled

---

## 7. Manajemen Master Data

### Tenant-Scoped Data

#### Customers

```
CRUD: /api/customers, /api/customers/[id]
Page: /customers
Fields: name, phone, email, address, city, postalCode, latitude, longitude
```

#### Drivers

```
CRUD: /api/drivers, /api/drivers/[id]
Page: /drivers
Fields: employeeId, name, phone, photo, status, userId (linked ke User akun)
Fitur: Driver scoring (completion rate + on-time rate + fail factor)
```

#### Vehicles

```
CRUD: /api/vehicles, /api/vehicles/[id]
Page: /vehicles
Fields: vehicleNumber, type, capacity, status, totalDistanceKm,
        photoFront, photoBack, photoRight, photoLeft, returning, returnedAt
Maintenance: /api/vehicles/[id]/maintenance
```

#### Geofences

```
CRUD: /api/geofences, /api/geofences/[id]
Page: /geofences
Fields: name, latitude, longitude, radiusMeters, type, description, active
Types: WAREHOUSE, HUB, OPERATIONAL_AREA, DESTINATION
```

#### Users

```
CRUD: /api/users, /api/users/[id]
Page: /users (hanya ADMIN_OPERASIONAL + SUPER_ADMIN)
Fields: name, username, password, role, status, phone, tenantId
Fitur: 2FA setup/disable, password policy
```

### Platform-Wide Data

#### Demo Requests

```
Submit: POST /api/demo-request (public)
Manage: GET/PATCH/DELETE /api/demo-requests (SUPER_ADMIN + ADMIN_OPERASIONAL)
Page: /demo-requests
Fields: name, email, phone, company, message, status
Status: PENDING → CONTACTED → COMPLETED / REJECTED
```

#### Audit Logs

```
Read: GET /api/audit (SUPER_ADMIN + ADMIN_OPERASIONAL)
Page: /audit
Fields: userId, action, module, oldData, newData, ip, method, path, userAgent
```

---

## 8. Reporting & Analitik

### Dashboard (`/dashboard`)

- Total shipment aktif / delivered / gagal
- Driver aktif / returning
- Kendaraan available / busy
- Grafik status breakdown

### Reports (`/reports`)

- Filter: tanggal, status, service type
- Tabel shipment detail
- Export CSV

### Analytics (`/analytics`)

**Driver Performance Scoring:**

```
completionRate = delivered / total
onTimeRate = onTime / delivered
failFactor = (failed === 0) ? 1.0 : 0.65

score = 100 × (0.5 × completionRate + 0.3 × onTimeRate) × failFactor
```

| Komponen | Bobot | Keterangan |
|---|---|---|
| Completion Rate | 50% | Persentase pengiriman berhasil |
| On-Time Rate | 30% | Persentase tepat waktu |
| Fail Factor | Pengali | 1.0 (tanpa gagal) atau 0.65 (ada gagal) |

---

## 9. Warehouse Operations

### Scan Flow

```
/warehouse/scan
  │
  ├── Input: Shipment ID / QR Code
  │
  ├── Pilih Aksi:
  │   ├── RECEIVE   — Barang masuk gudang
  │   ├── SORT      — Barang disortir
  │   ├── DISPATCH  — Barang diberangkatkan
  │   └── ARRIVE_HUB — Barang tiba di hub
  │
  ├── Opsional: Catatan + Koordinat GPS
  │
  └── POST /api/warehouse/scans
      → Buat WarehouseScan record
      → Update shipment status
      → Audit trail otomatis
```

---

## 10. Integrasi Eksternal

| Layanan | Fungsi | Konfigurasi |
|---|---|---|
| **PostgreSQL** | Database utama | `DATABASE_URL` |
| **Upstash Redis** | Rate limiting | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` |
| **WhatsApp API** | Notifikasi customer + alert | `WHATSAPP_API_URL` + `WHATSAPP_API_TOKEN` |
| **Google SSO** | Login alternatif | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` |
| **Sentry** | Error monitoring | `SENTRY_DSN` |
| **Leaflet + OpenStreetMap** | Peta interaktif | Client-side |
| **QR Code** | Tracking shipment | `qrcode` package |

---

## 11. Data Model & Relasi

### ER Diagram (Text)

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Tenant  │────<│   User   │────<│  Driver  │
└──────────┘     └──────────┘     └──────────┘
     │                │                │
     │                │                ├──< GpsLog
     │                │                ├──< GeofenceEvent
     │                │                ├──< DailyReport
     │                │                └──< DeliveryAssignment
     │                │
     │                └──< Notification
     │
     ├────< Customer ────< Shipment
     │                       │
     │                       ├──< ShipmentItem
     │                       ├──< ShipmentStop
     │                       ├──< TrackingEvent
     │                       ├──< ProofOfDelivery
     │                       ├──< DeliveryAssignment
     │                       ├──< WarehouseScan
     │                       └──< Notification
     │
     ├────< Vehicle
     │       ├──< DeliveryAssignment
     │       ├──< GpsLog
     │       └──< VehicleMaintenance
     │
     └────< Geofence
             └──< GeofenceEvent
```

### Tabel Pivot: DeliveryAssignment

```
Shipment ──┐
            ├── DeliveryAssignment ── Driver
Vehicle ───┘
```

Menghubungkan Shipment, Driver, dan Vehicle dalam satu penugasan.

---

## 12. API Reference

### Authentication

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login (username + password + tenantId) |
| POST | `/api/auth/two-factor` | Public | Verifikasi TOTP |
| POST | `/api/auth/logout` | Auth | Logout |
| GET | `/api/auth/me` | Auth | Info session saat ini |
| POST | `/api/auth/change-password` | Auth | Ubah password |
| POST | `/api/auth/2fa/setup` | Auth | Aktifkan 2FA |
| POST | `/api/auth/2fa/disable` | Auth | Nonaktifkan 2FA |
| GET | `/api/auth/tenants` | Public | Daftar tenant aktif |
| GET | `/api/auth/google` | Public | Redirect ke Google OAuth |
| GET | `/api/auth/google/callback` | Public | Callback Google OAuth |

### Shipments

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/shipments` | Auth | List (search, pagination) |
| POST | `/api/shipments` | Auth | Buat shipment baru |
| GET | `/api/shipments/[id]` | Auth | Detail shipment |
| PATCH | `/api/shipments/[id]` | Auth | Update shipment |
| POST | `/api/shipments/[id]/assign` | Auth | Assign driver + vehicle |
| POST | `/api/shipments/[id]/events` | Auth | Tambah tracking event |
| POST | `/api/shipments/[id]/pod` | Auth | Submit proof of delivery |
| POST | `/api/shipments/[id]/scan` | Auth | Warehouse scan |

### Drivers

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/drivers` | Auth | List (dengan scoring) |
| POST | `/api/drivers` | Auth | Tambah driver |
| GET | `/api/drivers/[id]` | Auth | Detail driver |
| PATCH | `/api/drivers/[id]` | Auth | Update driver |
| DELETE | `/api/drivers/[id]` | Auth | Hapus driver |

### Driver App

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/driver/tasks` | Auth (DRIVER) | Daftar tugas |
| GET | `/api/driver/tasks/[id]` | Auth (DRIVER) | Detail tugas |
| POST | `/api/driver/tasks/[id]` | Auth (DRIVER) | Update tugas |
| POST | `/api/driver/status` | Auth (DRIVER) | Update status driver |
| POST | `/api/driver/return` | Auth (DRIVER) | Return to base |
| POST | `/api/driver/daily-report` | Auth (DRIVER) | Laporan harian |

### Vehicles

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/vehicles` | Auth | List |
| POST | `/api/vehicles` | Auth | Tambah kendaraan |
| GET | `/api/vehicles/[id]` | Auth | Detail |
| PATCH | `/api/vehicles/[id]` | Auth | Update |
| DELETE | `/api/vehicles/[id]` | Auth | Hapus |
| GET | `/api/vehicles/[id]/maintenance` | Auth | Riwayat maintenance |
| POST | `/api/vehicles/[id]/maintenance` | Auth | Tambah maintenance |

### GPS & Tracking

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| POST | `/api/gps` | Auth (DRIVER) | Kirim GPS log |
| GET | `/api/gps/latest` | Auth | GPS terakhir semua driver |
| GET | `/api/gps/return-timeline` | Auth | Timeline return driver |
| GET | `/api/tracking/[resi]` | Public | Tracking publik |

### Customers

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/customers` | Auth | List |
| POST | `/api/customers` | Auth | Tambah |
| GET | `/api/customers/[id]` | Auth | Detail |
| PATCH | `/api/customers/[id]` | Auth | Update |
| DELETE | `/api/customers/[id]` | Auth | Hapus |

### Geofences

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/geofences` | Auth | List |
| POST | `/api/geofences` | Auth | Tambah |
| PATCH | `/api/geofences/[id]` | Auth | Update |
| DELETE | `/api/geofences/[id]` | Auth | Hapus |

### Users

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/users` | Auth (ADMIN+) | List |
| POST | `/api/users` | Auth (ADMIN+) | Tambah |
| GET | `/api/users/[id]` | Auth (ADMIN+) | Detail |
| PATCH | `/api/users/[id]` | Auth (ADMIN+) | Update |
| DELETE | `/api/users/[id]` | Auth (ADMIN+) | Hapus |

### Tenants

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/tenants` | Auth (SUPER_ADMIN) | List |
| POST | `/api/tenants` | Auth (SUPER_ADMIN) | Tambah |
| GET | `/api/tenants/[id]` | Auth (SUPER_ADMIN) | Detail |
| PATCH | `/api/tenants/[id]` | Auth (SUPER_ADMIN) | Update |
| DELETE | `/api/tenants/[id]` | Auth (SUPER_ADMIN) | Hapus |

### Notifications & System

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/notifications` | Auth | List notifikasi |
| POST | `/api/notifications/read` | Auth | Tandai sudah dibaca |
| POST | `/api/system/alerts` | Auth | Jalankan alert scan |
| GET | `/api/audit` | Auth (ADMIN+) | Audit log |
| GET | `/api/analytics` | Auth (ADMIN+) | Data analitik |

### Other

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| POST | `/api/demo-request` | Public | Submit demo request |
| GET | `/api/demo-requests` | Auth (ADMIN+) | List demo requests |
| PATCH | `/api/demo-requests` | Auth (ADMIN+) | Update status |
| DELETE | `/api/demo-requests` | Auth (SUPER_ADMIN) | Hapus |
| POST | `/api/upload` | Auth | Upload file |
| GET | `/api/files/[...path]` | Auth | Serve file |
| POST | `/api/warehouse/scans` | Auth | List warehouse scans |
| GET | `/api/daily-reports` | Auth | List laporan harian |
| POST | `/api/whatsapp/send` | Auth | Kirim WhatsApp |
| POST | `/api/whatsapp/webhook` | Public | Webhook WhatsApp |

---

## 13. Rekomendasi Enterprise Upgrade

### Prioritas Tinggi

| Aspek | Current | Enterprise Needed |
|---|---|---|
| **Multi-tenancy** | Basic (tenantId filter) | Row-level security, tenant isolation audit, namespace |
| **Auth** | JWT + TOTP | RBAC granularity, session management, SAML/OIDC, SCIM provisioning |
| **API** | REST | REST + GraphQL, API versioning, per-tenant rate limiting, API keys |
| **Real-time** | Polling GPS | WebSocket (Socket.io), server-sent events, push notifications |
| **File storage** | Local/inline | S3-compatible (MinIO/AWS S3), CDN, image optimization |
| **Email** | None | Transactional email (Resend/SES), email templates, email tracking |

### Prioritas Menengah

| Aspek | Current | Enterprise Needed |
|---|---|---|
| **Background jobs** | Cron script | Job queue (BullMQ/Inngest), retries, dead letter, scheduling |
| **Observability** | Sentry only | Structured logging (Pino), metrics (Prometheus), distributed tracing (OpenTelemetry) |
| **Testing** | Vitest (unit) | Integration tests, E2E (Playwright), load testing (k6), mutation testing |
| **Deployment** | Manual | CI/CD (GitHub Actions), blue-green deployment, canary releases, rollback |
| **Compliance** | None | GDPR, data retention policies, audit export, PII masking |

### Prioritas Rendah (Scale)

| Aspek | Current | Enterprise Needed |
|---|---|---|
| **Billing** | Plan field only | Stripe integration, usage metering, invoicing, subscription management |
| **Mobile** | PWA | Native app (React Native), offline support, push notifications |
| **Search** | PostgreSQL LIKE | Full-text search, Elasticsearch/Meilisearch, fuzzy matching |
| **Caching** | None | Redis caching layer for dashboard, reports, hot queries |
| **I18n** | Bahasa Indonesia | Multi-language support (en, id, etc.) |
| **Accessibility** | Basic | WCAG 2.1 AA compliance, screen reader support, keyboard navigation |

---

> Dokumentasi ini dihasilkan dari kode sumber DTMS v2.0.0
> Terakhir diperbarui: Agustus 2026
