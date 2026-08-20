/**
 * Bulk Seed Script — DTMS Stress Test
 * Usage: npx tsx scripts/bulk-seed.ts
 * Full:  TENANT_COUNT=10000 npx tsx scripts/bulk-seed.ts
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient({ log: ['error'] });

const TENANT_COUNT = parseInt(process.env.TENANT_COUNT || '100');
const DRIVERS_PER_TENANT = parseInt(process.env.DRIVERS_PER_TENANT || '10');
const SHIPMENTS_PER_TENANT = parseInt(process.env.SHIPMENTS_PER_TENANT || '1000');

const CITIES = ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar', 'Palembang', 'Tangerang', 'Depok', 'Bekasi',
  'Yogyakarta', 'Malang', 'Solo', 'Bogor', 'Denpasar', 'Manado', 'Banjarmasin', 'Pekanbaru', 'Balikpapan', 'Pontianak'];
const FNames = ['Andi', 'Budi', 'Citra', 'Dewi', 'Eka', 'Fajar', 'Gita', 'Hadi', 'Indah', 'Joko', 'Kartika', 'Lestari', 'Maya', 'Nurul', 'Putri', 'Rizky', 'Sari', 'Tono'];
const LNames = ['Pratama', 'Sari', 'Wijaya', 'Putra', 'Saputra', 'Ramadhan', 'Hidayat', 'Setiawan', 'Nugroho', 'Santoso', 'Kusuma', 'Wibowo'];
const PLANS = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];
const SVC = ['REGULAR', 'NEXT_DAY', 'SAME_DAY'];
const STS = ['ORDER_CREATED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'WAREHOUSE_RECEIVED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'];

function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function phone() { return '08' + String(rnd(1000000000, 9999999999)).slice(0, 10); }
function randLat(base: number) { return base + (Math.random() - 0.5) * 0.5; }

let t0 = Date.now();
function log(label: string, cur: number, total: number) {
  const pct = ((cur / total) * 100).toFixed(1);
  const sec = ((Date.now() - t0) / 1000).toFixed(0);
  process.stdout.write(`\r[${pct}%] ${label}: ${cur.toLocaleString()} / ${total.toLocaleString()} (${sec}s)`);
}

function esc(s: string) { return s.replace(/'/g, "''"); }

async function main() {
  t0 = Date.now();
  const totalDrivers = TENANT_COUNT * DRIVERS_PER_TENANT;
  const totalCustomers = TENANT_COUNT * 2;
  const totalShipments = TENANT_COUNT * SHIPMENTS_PER_TENANT;

  console.log('=== DTMS Bulk Seed ===');
  console.log(`Tenants: ${TENANT_COUNT} | Drivers: ${totalDrivers} | Customers: ${totalCustomers} | Shipments: ${totalShipments}\n`);

  // Clean
  console.log('Cleaning...');
  const fkTables = [
    'TrackingEvent', 'ProofOfDelivery', 'DeliveryAssignment', 'ShipmentItem', 'ShipmentStop',
    'WarehouseScan', 'Notification', 'ShipmentEvent', 'Exception', 'SlaEvent',
    'GpsLog', 'GeofenceEvent', 'DailyReport', 'AuditLog', 'Message',
    'Invoice', 'Payment', 'UsageRecord', 'Shipment', 'Driver', 'Customer',
    'Vehicle', 'Geofence', 'Company', 'Branch', 'Warehouse', 'RolePermission',
    'IntegrationConfig', 'ApiKey', 'WebhookSubscription', 'UploadedFile',
    'Subscription', 'DemoRequest', 'TenantRateLimit', 'PasswordResetToken',
    'User', 'Tenant',
  ];
  for (const t of fkTables) await prisma.$executeRawUnsafe('DELETE FROM "' + t + '"');
  console.log('Done.\n');

  // --- TENANTS ---
  console.log('Creating tenants...');
  const tenantIds: string[] = [];
  const bases: { lat: number; lng: number }[] = [];
  for (let i = 0; i < TENANT_COUNT; i++) {
    const id = randomUUID();
    tenantIds.push(id);
    bases.push({ lat: -6 + Math.random() * 10, lng: 95 + Math.random() * 15 });
  }
  // Batch insert tenants
  const tenantValues = tenantIds.map((id, i) => {
    const name = esc('PT Transportindo ' + (i + 1));
    const slug = 'tenant-' + String(i + 1).padStart(5, '0');
    const code = 'T' + String(i + 1).padStart(5, '0');
    return `('${id}','${name}','${slug}','${code}','ACTIVE','${pick(PLANS)}','Asia/Jakarta','id-ID','IDR','Admin','admin@test.com','081234567890',50,100,10000,true,'#2563eb','#1e40af','#3b82f6',now(),now())`;
  });
  for (let i = 0; i < tenantValues.length; i += 500) {
    const batch = tenantValues.slice(i, i + 500);
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Tenant" ("id","name","slug","code","status","plan","timezone","locale","currency","contactName","contactEmail","contactPhone","maxUsers","maxDrivers","maxShipments","active","primaryColor","secondaryColor","accentColor","createdAt","updatedAt")
      VALUES ${batch.join(',')}
    `);
  }
  log('Tenants', TENANT_COUNT, TENANT_COUNT);
  console.log('\n');

  // --- DRIVERS ---
  console.log('Creating drivers...');
  let drvDone = 0;
  for (let i = 0; i < TENANT_COUNT; i += 200) {
    const end = Math.min(i + 200, TENANT_COUNT);
    const batch: string[] = [];
    for (let t = i; t < end; t++) {
      for (let d = 0; d < DRIVERS_PER_TENANT; d++) {
        const idx = t * DRIVERS_PER_TENANT + d;
        const name = esc(pick(FNames) + ' ' + pick(LNames));
        const empId = 'DRV' + String(idx + 1).padStart(7, '0');
        const id = randomUUID();
        batch.push(`('${id}','${empId}','${name}','${phone()}','ACTIVE','${tenantIds[t]}')`);
      }
    }
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Driver" ("id","employeeId","name","phone","status","tenantId")
      VALUES ${batch.join(',')}
    `);
    drvDone += batch.length;
    log('Drivers', drvDone, totalDrivers);
  }
  console.log('\n');

  // --- CUSTOMERS ---
  console.log('Creating customers...');
  const custIds = new Map<string, string[]>();
  const custValues: string[] = [];
  for (let t = 0; t < TENANT_COUNT; t++) {
    const ids = [randomUUID(), randomUUID()];
    custIds.set(tenantIds[t], ids);
    for (const cid of ids) {
      const name = esc(pick(FNames) + ' ' + pick(LNames));
      custValues.push(`('${cid}','${name}','${phone()}','${esc(pick(FNames).toLowerCase() + '@test.com')}','${tenantIds[t]}',now())`);
    }
  }
  for (let i = 0; i < custValues.length; i += 1000) {
    const batch = custValues.slice(i, i + 1000);
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Customer" ("id","name","phone","email","tenantId","createdAt")
      VALUES ${batch.join(',')}
    `);
  }
  log('Customers', totalCustomers, totalCustomers);
  console.log('\n');

  // --- SHIPMENTS ---
  console.log('Creating shipments...');
  let shipDone = 0;

  for (let t = 0; t < TENANT_COUNT; t++) {
    const tid = tenantIds[t];
    const [senderId, receiverId] = custIds.get(tid) || ['', ''];
    const base = bases[t];
    const batch: string[] = [];

    for (let s = 0; s < SHIPMENTS_PER_TENANT; s++) {
      const trk = 'TRK' + String(t + 1).padStart(4, '0') + String(s + 1).padStart(8, '0');
      const oLat = randLat(base.lat).toFixed(6);
      const oLng = randLat(base.lng).toFixed(6);
      const dLat = randLat(base.lat).toFixed(6);
      const dLng = randLat(base.lng).toFixed(6);
      const wt = (Math.random() * 50 + 0.1).toFixed(2);
      const vol = (Math.random() * 2 + 0.01).toFixed(2);
      const st = (Math.random() * 5000000 + 10000).toFixed(0);
      const daysAgo = rnd(0, 2592000000);
      const dt = new Date(Date.now() - daysAgo).toISOString();

      batch.push(
        `('${randomUUID()}','${trk}','${tid}','${senderId}','${receiverId}',` +
        `'${pick(CITIES)}','${pick(CITIES)}',${oLat},${oLng},${dLat},${dLng},` +
        `${wt},${vol},'${pick(SVC)}','${pick(STS)}',` +
        `${Math.random() > 0.8},'Paket',${rnd(1, 20)},'Elektronik',${st},'${dt}','${dt}')`
      );

      if (batch.length === 500) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "Shipment" ("id","trackingNumber","tenantId","senderId","receiverId",
            "origin","destination","originLat","originLng","destLat","destLng",
            "weight","volume","serviceType","status",
            "fragile","itemName","itemCount","itemCategory","itemValue","createdAt","updatedAt")
          VALUES ${batch.join(',')}
        `);
        shipDone += batch.length;
        batch.length = 0;
      }
    }

    if (batch.length > 0) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Shipment" ("id","trackingNumber","tenantId","senderId","receiverId",
          "origin","destination","originLat","originLng","destLat","destLng",
          "weight","volume","serviceType","status",
          "fragile","itemName","itemCount","itemCategory","itemValue","createdAt","updatedAt")
        VALUES ${batch.join(',')}
      `);
      shipDone += batch.length;
    }

    log('Shipments', shipDone, totalShipments);
  }
  console.log('\n');

  // --- USERS ---
  console.log('Creating users...');
  for (let t = 0; t < TENANT_COUNT; t += 500) {
    const end = Math.min(t + 500, TENANT_COUNT);
    const batch: string[] = [];
    for (let i = t; i < end; i++) {
      const u = 'admin' + String(i + 1).padStart(5, '0');
      batch.push(`('${randomUUID()}','${u}','placeholder','${u}','${u}@test.com','ADMIN_OPERASIONAL','ACTIVE','LOCAL','${tenantIds[i]}',1,false,now())`);
    }
    await prisma.$executeRawUnsafe(`
      INSERT INTO "User" ("id","username","passwordHash","name","email","role","status","provider","tenantId","pwdVersion","mustChangePassword","createdAt")
      VALUES ${batch.join(',')}
    `);
  }
  log('Users', TENANT_COUNT, TENANT_COUNT);

  // --- SUMMARY ---
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n\n=== COMPLETE ===');
  const counts: any[] = await prisma.$queryRawUnsafe(`
    SELECT 'Tenants' as t, COUNT(*) as c FROM "Tenant"
    UNION ALL SELECT 'Users', COUNT(*) FROM "User"
    UNION ALL SELECT 'Drivers', COUNT(*) FROM "Driver"
    UNION ALL SELECT 'Customers', COUNT(*) FROM "Customer"
    UNION ALL SELECT 'Shipments', COUNT(*) FROM "Shipment"
  `);
  for (const r of counts) console.log(`  ${r.t}: ${r.c}`);
  console.log(`  Time: ${elapsed}s`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
