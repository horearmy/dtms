# Dokumentasi: Multi-Tenant Data Isolation

## Ringkasan

Dokumentasi ini menjelaskan arsitektur isolasi data multi-tenant pada DTMS, termasuk mekanisme otomatis via Prisma middleware, daftar model yang di-scope, route yang diperbaiki, dan pedoman untuk pengembang di masa depan.

---

## 1. Arsitektur Isolasi Data

### 1.1 AsyncLocalStorage (`tenantStore`)

Setiap request yang masuk dibungkus dalam `runWithTenant(tenantId, callback)` yang menggunakan Node.js `AsyncLocalStorage` untuk menyimpan `tenantId` aktif sepanjang lifecycle request tersebut.

```
Request masuk → guardPermission() → runWithTenant(tenantId, async () => {
  // Semua query prisma di sini otomatis di-scoping ke tenantId
})
```

**File:** `src/lib/api-guard.ts` — `runWithTenant()`
**File:** `src/lib/prisma.ts` — `tenantStore` (AsyncLocalStorage)

### 1.2 Prisma Query Middleware

Prisma Client di-extend dengan query middleware yang mengintercept semua operasi database. Middleware ini:

1. **Membaca `tenantId`** dari `AsyncLocalStorage`
2. **Auto-inject `tenantId`** ke `where` clause pada operasi baca (findMany, findFirst, count)
3. **Auto-inject `tenantId`** ke `data` pada operasi tulis (create, createMany)
4. **Post-check `tenantId`** pada `findUnique` — mengembalikan `null` jika record bukan milik tenant saat ini

**File:** `src/lib/prisma.ts`

---

## 2. Model yang Di-Scope (TENANT_SCOPED)

Hanya model yang memiliki kolom `tenantId` di schema Prisma yang di-intercept otomatis oleh middleware.

### 2.1 Model dengan `tenantId` Required (String)

| Model | Keterangan |
|---|---|
| `User` | Pengguna sistem (SUPER_ADMIN memiliki tenantId null) |
| `Customer` | Data pelanggan |
| `Shipment` | Data pengiriman |
| `ShipmentStop` | Titik transitshipment |
| `ShipmentItem` | Item dalam shipment |
| `Driver` | Data driver |
| `Vehicle` | Data kendaraan |
| `VehicleMaintenance` | Perawatan kendaraan |
| `DailyReport` | Laporan harian driver |
| `Company` | Data perusahaan |
| `Branch` | Cabang |
| `Department` | Departemen |
| `Warehouse` | Gudang |
| `Hub` | Hub distribusi |
| `ShipmentEvent` | Riwayat status shipment |
| `Exception` | Pengecualian/insiden |
| `SlaPolicy` | Kebijakan SLA |
| `SlaEvent` | Event pelanggaran SLA |
| `Subscription` | Langganan tenant |
| `Invoice` | Tagihan |
| `Payment` | Pembayaran |
| `UsageRecord` | Catatan penggunaan |
| `IntegrationConfig` | Konfigurasi integrasi |
| `ApiKey` | Kunci API |
| `WebhookSubscription` | Langganan webhook |
| `UploadedFile` | File yang diunggah |
| `DemoRequest` | Permintaan demo |
| `RolePermission` | Permission per role |

### 2.2 Model TANPA `tenantId` (Perlu Manual Filtering)

Model berikut **tidak** memiliki kolom `tenantId` dan **tidak** di-intercept oleh middleware. Filtering harus dilakukan secara manual melalui relasi parent.

| Model | Relasi ke Tenant | Contoh Filter |
|---|---|---|
| `DeliveryAssignment` | via `Shipment.tenantId` | `where: { shipment: { tenantId: ... } }` |
| `TrackingEvent` | via `Shipment.tenantId` | `where: { shipment: { tenantId: ... } }` |
| `GpsLog` | via `Driver.tenantId` | `where: { driver: { tenantId: ... } }` |
| `ProofOfDelivery` | via `Shipment.tenantId` | `where: { shipment: { tenantId: ... } }` |
| `Notification` | via `Shipment.tenantId` | `where: { shipment: { tenantId: ... } }` |
| `AuditLog` | via `User.tenantId` | `where: { user: { tenantId: ... } }` |
| `WarehouseScan` | via `Shipment.tenantId` | `where: { shipment: { tenantId: ... } }` |
| `GeofenceEvent` | via `Geofence.tenantId` | `where: { geofence: { tenantId: ... } }` |
| `WebhookDelivery` | via `WebhookSubscription.tenantId` | via parent |
| `IntegrationLog` | via `IntegrationConfig.tenantId` | via parent |

---

## 3. Operasi Middleware

### 3.1 findUnique (Post-Check)

```typescript
async findUnique({ args, query }) {
  const result = await query(args);        // Jalankan query asli
  if (!result) return null;
  const tenantId = tenantStore.getStore();
  if (!tenantId || !TENANT_SCOPED.has(model)) return result;
  if ('tenantId' in result && result.tenantId !== null && result.tenantId !== tenantId) {
    return null;  // Record bukan milik tenant ini
  }
  return result;
}
```

**Catatan:** `findUnique` tidak bisa di-intercept dengan menambahkan `tenantId` ke where clause karena Prisma hanya menerima unique fields. Solusinya adalah post-check: jalankan query, lalu verifikasi ownership.

### 3.2 findMany / findFirst / count (Pre-Filter)

```typescript
async findMany({ args, query }) {
  const tenantId = tenantStore.getStore();
  if (!tenantId || !TENANT_SCOPED.has(model)) return query(args);
  // Tambahkan tenantId ke where clause
  return query(addTenantFilter(args, tenantId));
}
```

### 3.3 create / createMany (Auto-Inject)

```typescript
async create({ args, query }) {
  const tenantId = tenantStore.getStore();
  if (!tenantId || !TENANT_SCOPED.has(model)) return query(args);
  return query({ ...args, data: injectTenantId(args.data, tenantId) });
}
```

`injectTenantId` hanya menyuntikkan jika `tenantId` belum ada atau kosong di data.

### 3.4 update / updateMany / delete / deleteMany (Pre-Filter)

Sama seperti findMany — menambahkan `tenantId` ke where clause.

---

## 4. Route yang Diperbaiki

### 4.1 Route dengan `runWithTenant` Baru

Berikut route yang sebelumnya **tidak** memiliki `runWithTenant()` dan telah diperbaiki:

| Route | File | Masalah Sebelumnya |
|---|---|---|
| `GET/POST /api/dispatch` | `dispatch/route.ts` | POST tanpa tenant context |
| `GET/POST /api/driver/tasks` | `driver/tasks/route.ts` | Tanpa tenant context |
| `POST /api/driver/sync` | `driver/sync/route.ts` | Tanpa tenant context |
| `GET/POST /api/driver/daily-report` | `driver/daily-report/route.ts` | Tanpa tenant context |
| `GET /api/driver/tasks/:id` | `driver/tasks/[assignmentId]/route.ts` | Tanpa tenant context |
| `PATCH /api/exceptions/:id` | `exceptions/[id]/route.ts` | findUnique tanpa verifikasi |
| `GET/POST /api/exceptions` | `exceptions/route.ts` | Manual filter, tidak konsisten |
| `GET/POST /api/shipment-events` | `shipment-events/route.ts` | Tanpa tenant context |
| `GET /api/tracking/current` | `tracking/current/route.ts` | Raw SQL tanpa filter |
| `GET/POST /api/webhooks` | `webhooks/route.ts` | Manual filter |
| `PATCH/DELETE /api/webhooks/:id` | `webhooks/[id]/route.ts` | Manual filter |
| `GET/POST /api/integrations` | `integrations/route.ts` | Manual filter |
| `GET/PATCH/DELETE /api/integrations/:id` | `integrations/[id]/route.ts` | Manual filter |
| `GET/POST /api/sla-policies` | `sla-policies/route.ts` | Manual filter |
| `GET/POST /api/sla-events` | `sla-events/route.ts` | Manual filter |
| `GET/POST /api/api-keys` | `api-keys/route.ts` | Manual filter |
| `GET /api/files` | `files/route.ts` | Manual filter |
| `POST /api/upload` | `upload/route.ts` | Manual filter |
| `GET /api/control-tower` | `control-tower/route.ts` | Manual filter |
| `GET/PATCH /api/billing/invoices` | `billing/invoices/route.ts` | Manual filter |
| `GET /api/customer/shipments` | `customer/shipments/route.ts` | Manual filter |

### 4.2 Route dengan Manual Tenant Scoping (Model Tanpa tenantId)

| Route | File | Model | Filter |
|---|---|---|---|
| `GET /api/notifications` | `notifications/route.ts` | `Notification` | via `shipment.tenantId` |
| `POST /api/notifications/read` | `notifications/read/route.ts` | `Notification` | via `shipment.tenantId` |
| `GET /api/warehouse/scans` | `warehouse/scans/route.ts` | `WarehouseScan` | via `shipment.tenantId` |
| `GET /api/gps/latest` | `gps/latest/route.ts` | `GpsLog` | via `driver.tenantId` |
| `GET /api/gps/return-timeline` | `gps/return-timeline/route.ts` | `GpsLog` | verifikasi driver ownership |

### 4.3 Raw SQL dengan Tenant Filter

`GET /api/tracking/current` menggunakan raw SQL yang sebelumnya tidak di-filter:

```sql
-- Sebelum (cross-tenant):
SELECT DISTINCT ON ("driverId") ...
FROM "GpsLog"
WHERE "createdAt" > NOW() - INTERVAL '2 hours'

-- Sesudah (tenant-scoped):
SELECT DISTINCT ON ("driverId") ...
FROM "GpsLog"
WHERE "createdAt" > NOW() - INTERVAL '2 hours'
  AND "tenantId" = ${session.tenantId}
```

---

## 5. Pola untuk Pengembang

### 5.1 Route Baru dengan Model TENANT_SCOPED

```typescript
import { guardPermission, runWithTenant } from '@/lib/api-guard';

export async function GET() {
  const { session, error } = await guardPermission(PERMISSIONS.X.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    // Semua query prisma di sini otomatis di-scoping
    const items = await prisma.someModel.findMany();
    return NextResponse.json(items);
  });
}
```

### 5.2 Route Baru dengan Model TANPA tenantId

```typescript
import { guardPermission, runWithTenant } from '@/lib/api-guard';

export async function GET() {
  const { session, error } = await guardPermission(PERMISSIONS.X.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    // Model tanpa tenantId — filter manual via relasi
    const items = await prisma.notification.findMany({
      where: {
        shipment: { tenantId: session?.tenantId },
      },
    });
    return NextResponse.json(items);
  });
}
```

### 5.3 Create dengan Model yang Memiliki tenantId Required

```typescript
// Middleware akan auto-inject, tapi TypeScript tetap membutuhkan field
const record = await prisma.someModel.create({
  data: {
    tenantId: session!.tenantId!,  // Required oleh TypeScript
    name: '...',
    // Middleware tidak overwrite jika sudah ada
  },
});
```

### 5.4 Raw SQL

```typescript
import { Prisma } from '@prisma/client';

const tenantCondition = session?.tenantId
  ? Prisma.sql`AND "tenantId" = ${session.tenantId}`
  : Prisma.sql``;

const rows = await prisma.$queryRaw`
  SELECT * FROM "SomeTable"
  WHERE "active" = true
  ${tenantCondition}
`;
```

---

## 6. Checklist untuk Review Keamanan Multi-Tenant

Ketika menambahkan route atau query baru, pastikan:

- [ ] Route membungkus handler dengan `runWithTenant(session?.tenantId ?? null, async () => { ... })`
- [ ] Query pada model TENANT_SCOPED tidak memiliki manual `tenantId` filter (middleware handle)
- [ ] Query pada model TANPA `tenantId` memiliki manual filter via relasi parent
- [ ] `findUnique` pada model TENANT_SCOPED tidak perlu manual filter (middleware post-check)
- [ ] Raw SQL memiliki `WHERE "tenantId" = ${tenantId}` clause
- [ ] Create pada model dengan `tenantId` required menyertakan field tersebut untuk TypeScript
- [ ] Tidak ada query yang mengembalikan data lintas tenant

---

## 7. Known Limitations

1. **findUnique post-check mengembalikan null** — Jika user mencoba akses record milik tenant lain via `findUnique`, hasilnya `null` (bukan error 403). Ini konsisten dengan behavior "record tidak ditemukan".

2. **SUPER_ADMIN memiliki tenantId: null** — Middleware tidak melakukan filtering jika `tenantId` adalah `null`. SUPER_ADMIN dapat mengakses data dari semua tenant.

3. **Raw SQL harus di-filter manual** — Prisma middleware tidak intercept raw query. Pastikan selalu menyertakan `WHERE "tenantId"` pada raw SQL.

4. **Model tanpa tenantId** — Beberapa model (notification, gpsLog, deliveryAssignment, dll) tidak memiliki kolom `tenantId`. Filtering harus dilakukan melalui relasi parent (shipment, driver, dll).

---

## 8. File Referensi

| File | Fungsi |
|---|---|
| `src/lib/prisma.ts` | Prisma middleware, tenantStore, TENANT_SCOPED list |
| `src/lib/api-guard.ts` | `runWithTenant()`, `guardPermission()`, session handling |
| `src/lib/access-scope.ts` | `resolveAccessScope()` — SUPER_ADMIN returns `['*']` |
| `src/middleware.ts` | CSRF cookie, route protection |
| `prisma/schema.prisma` | Skema database — kolom `tenantId` per model |
