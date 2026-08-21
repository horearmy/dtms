/**
 * STRESS TEST — Burst Force: 1M Hierarchies + 1M Regions + Shipment Simulation
 *
 * Targets (configurable via env):
 *   HIERARCHY_TOTAL  = 1,000,000  (Organization + Branch)
 *   REGION_TOTAL     = 1,000,000  (Region per tenant)
 *   SHIPMENTS_PER_DRIVER = 5       (active shipments per driver)
 *
 * Usage:
 *   npx tsx scripts/stress-burst.ts
 *   HIERARCHY_TOTAL=2000000 npx tsx scripts/stress-burst.ts
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient({ log: ['error'] });

const HIERARCHY_TOTAL = parseInt(process.env.HIERARCHY_TOTAL || '1000000');
const REGION_TOTAL = parseInt(process.env.REGION_TOTAL || '1000000');
const SHIPMENTS_PER_DRIVER = parseInt(process.env.SHIPMENTS_PER_DRIVER || '5');
const BATCH = 5000;

const CITIES = ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar', 'Palembang',
  'Tangerang', 'Depok', 'Bekasi', 'Yogyakarta', 'Malang', 'Solo', 'Bogor', 'Denpasar',
  'Manado', 'Banjarmasin', 'Pekanbaru', 'Balikpapan', 'Pontianak'];
const SVC: ('REGULAR' | 'NEXT_DAY' | 'SAME_DAY')[] = ['REGULAR', 'NEXT_DAY', 'SAME_DAY'];
const STS: ('ORDER_CREATED' | 'PICKUP_SCHEDULED' | 'PICKED_UP' | 'WAREHOUSE_RECEIVED' | 'DISPATCHED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED')[] =
  ['ORDER_CREATED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'WAREHOUSE_RECEIVED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'];

function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function esc(s: string) { return s.replace(/'/g, "''"); }
function randLat(base: number) { return +(base + (Math.random() - 0.5) * 0.5).toFixed(6); }
function randLng(base: number) { return +(base + (Math.random() - 0.5) * 0.5).toFixed(6); }

let t0 = Date.now();
let totalRows = 0;
let globalRegionOffset = 0;
function log(label: string, cur: number, total: number) {
  const pct = ((cur / total) * 100).toFixed(1);
  const sec = ((Date.now() - t0) / 1000).toFixed(0);
  const rate = Math.round(cur / Math.max(1, Date.now() - t0) * 1000);
  process.stdout.write(`\r  [${pct}%] ${label}: ${cur.toLocaleString()} / ${total.toLocaleString()} | ${rate.toLocaleString()}/s (${sec}s)`);
}

type TenantInfo = { id: string; name: string };

async function phase1Hierarchy(tenants: TenantInfo[]) {
  console.log(`\n=== PHASE 1: ${HIERARCHY_TOTAL.toLocaleString()} Hierarchies (Organization + Branch) ===`);

  const orgPerTenant = Math.ceil(HIERARCHY_TOTAL / tenants.length / 2);
  const branchPerOrg = 2;
  let created = 0;

  // Get offset from existing counts to avoid conflicts
  const existingOrgCount = await prisma.$queryRawUnsafe<{ cnt: number }[]>(`SELECT COUNT(*)::int as cnt FROM "Organization"`);
  let orgOffset = existingOrgCount[0].cnt;
  const existingBranchCount = await prisma.$queryRawUnsafe<{ cnt: number }[]>(`SELECT COUNT(*)::int as cnt FROM "Branch"`);
  let branchOffset = existingBranchCount[0].cnt;
  const existingRegionCount = await prisma.$queryRawUnsafe<{ cnt: number }[]>(`SELECT COUNT(*)::int as cnt FROM "Region"`);
  let regionOffset = existingRegionCount[0].cnt;
  globalRegionOffset = regionOffset;

  for (const tenant of tenants) {
    const tenantOrgs = Math.min(orgPerTenant, Math.ceil((HIERARCHY_TOTAL - created) / Math.max(1, tenants.indexOf(tenant) + 1)));
    if (created >= HIERARCHY_TOTAL) break;

    // Create Organizations in batch — track which actually got inserted
    const orgValues: string[] = [];
    const orgInsertIds: string[] = [];
    for (let i = 0; i < tenantOrgs && created < HIERARCHY_TOTAL; i++) {
      const id = randomUUID();
      orgOffset++;
      const code = `ORG${String(orgOffset).padStart(8, '0')}`;
      const name = `Org ${esc(pick(CITIES))} ${orgOffset}`;
      orgValues.push(`('${id}','${esc(tenant.id)}','${esc(name)}','${code}',NOW(),NOW(),true)`);
      orgInsertIds.push(id);
      created++;
    }

    let actualOrgIds: string[] = [];
    if (orgValues.length > 0) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Organization" ("id","tenantId","name","code","createdAt","updatedAt","active")
        VALUES ${orgValues.join(',')}
        ON CONFLICT ("tenantId","code") DO NOTHING
      `);
      // Query back only the IDs we just tried to insert
      if (orgInsertIds.length > 0) {
        const inserted = await prisma.$queryRawUnsafe<{ id: string }[]>(
          `SELECT "id" FROM "Organization" WHERE "id" = ANY($1::text[])`,
          orgInsertIds
        );
        actualOrgIds = inserted.map(r => r.id);
      }
    }

    // Create Branches — only for actually inserted orgs
    const branchValues: string[] = [];
    for (const orgId of actualOrgIds) {
      for (let b = 0; b < branchPerOrg && created < HIERARCHY_TOTAL; b++) {
        const id = randomUUID();
        branchOffset++;
        const code = `BR${String(branchOffset).padStart(8, '0')}`;
        const city = pick(CITIES);
        const lat = randLat(-6.2);
        const lng = randLng(106.8);
        branchValues.push(`('${id}','${esc(tenant.id)}','${esc(orgId)}','Branch ${esc(pick(CITIES))} ${branchOffset}','${code}','${esc(city)}',${lat},${lng},NOW(),NOW(),true)`);
        created++;
      }
    }

    if (branchValues.length > 0) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Branch" ("id","tenantId","organizationId","name","code","city","latitude","longitude","createdAt","updatedAt","active")
        VALUES ${branchValues.join(',')}
        ON CONFLICT ("tenantId","code") DO NOTHING
      `);
    }

    if (tenants.indexOf(tenant) % 100 === 0 || tenants.indexOf(tenant) === tenants.length - 1) {
      log('Organizations+Branches', created, HIERARCHY_TOTAL);
    }
  }

  console.log(`\n  => ${created.toLocaleString()} hierarchies created`);
  totalRows += created;
}

async function phase2Regions(tenants: TenantInfo[]) {
  console.log(`\n=== PHASE 2: ${REGION_TOTAL.toLocaleString()} Regions ===`);

  const regionPerTenant = Math.ceil(REGION_TOTAL / tenants.length);
  let created = 0;

  for (const tenant of tenants) {
    if (created >= REGION_TOTAL) break;
    const count = Math.min(regionPerTenant, REGION_TOTAL - created);
    const values: string[] = [];

    for (let i = 0; i < count; i++) {
      const id = randomUUID();
      globalRegionOffset++;
      const code = `REG${String(globalRegionOffset).padStart(8, '0')}`;
      const name = `Region ${esc(pick(CITIES))} ${globalRegionOffset}`;
      const lat = randLat(-2.5);
      const lng = randLng(118);
      values.push(`('${id}','${esc(tenant.id)}','${esc(name)}','${code}',${lat},${lng},NOW(),NOW(),true)`);
    }

    await prisma.$executeRawUnsafe(`
      INSERT INTO "Region" ("id","tenantId","name","code","latitude","longitude","createdAt","updatedAt","active")
      VALUES ${values.join(',')}
      ON CONFLICT ("tenantId","code") DO NOTHING
    `);

    created += count;
    if (tenants.indexOf(tenant) % 100 === 0 || tenants.indexOf(tenant) === tenants.length - 1) {
      log('Regions', created, REGION_TOTAL);
    }
  }

  console.log(`\n  => ${created.toLocaleString()} regions created`);
  totalRows += created;
}

async function phase3Shipments(tenants: TenantInfo[]) {
  console.log(`\n=== PHASE 3: Tracking Events + Delivery Assignments on existing shipments ===`);

  let totalEvents = 0;
  let totalAssignments = 0;

  for (const tenant of tenants) {
    // Get shipments that have NO tracking events yet (limit to keep it fast)
    const shipments = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT s."id" FROM "Shipment" s
       WHERE s."tenantId" = $1 AND NOT EXISTS (SELECT 1 FROM "TrackingEvent" te WHERE te."shipmentId" = s."id")
       LIMIT 10`,
      tenant.id
    );

    if (shipments.length === 0) continue;

    // Get active drivers for this tenant
    const drivers = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT "id" FROM "Driver" WHERE "tenantId" = $1 AND "status" = 'ACTIVE' LIMIT 10`,
      tenant.id
    );

    // Create tracking events for each shipment
    const eventValues: string[] = [];
    for (const ship of shipments) {
      const eventCount = rnd(2, 5);
      for (let e = 0; e < eventCount; e++) {
        const evStatus = STS[Math.min(e, STS.length - 1)];
        const lat = randLat(-6.2);
        const lng = randLng(106.8);
        const evId = randomUUID();
        const ts = new Date(Date.now() - rnd(0, 43200000)).toISOString();
        eventValues.push(`('${evId}','${ship.id}','${evStatus}',${lat},${lng},'Stress test event','system','${ts}')`);
      }
    }

    if (eventValues.length > 0) {
      const chunks = chunk(eventValues, BATCH);
      for (const c of chunks) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "TrackingEvent" ("id","shipmentId","status","latitude","longitude","notes","createdBy","createdAt")
          VALUES ${c.join(',')}
        `);
        totalEvents += c.length;
      }
    }

    // Create delivery assignments for shipments without one
    if (drivers.length > 0) {
      const assignValues: string[] = [];
      for (const ship of shipments) {
        const driver = pick(drivers);
        assignValues.push(`('${randomUUID()}','${ship.id}','${driver.id}',NOW())`);
      }
      if (assignValues.length > 0) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "DeliveryAssignment" ("id","shipmentId","driverId","assignedAt")
          VALUES ${assignValues.join(',')}
          ON CONFLICT DO NOTHING
        `);
        totalAssignments += assignValues.length;
      }
    }

    if (tenants.indexOf(tenant) % 500 === 0 || tenants.indexOf(tenant) === tenants.length - 1) {
      process.stdout.write(`\r  Tenant ${tenants.indexOf(tenant) + 1}/${tenants.length} | Events: ${totalEvents.toLocaleString()} | Assignments: ${totalAssignments.toLocaleString()}`);
    }
  }

  console.log(`\n  => ${totalEvents.toLocaleString()} tracking events created`);
  console.log(`  => ${totalAssignments.toLocaleString()} delivery assignments created`);
  totalRows += totalEvents + totalAssignments;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

async function main() {
  t0 = Date.now();
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   DTMS STRESS TEST — Burst Force                ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║ Hierarchies:  ${HIERARCHY_TOTAL.toLocaleString().padStart(12)}               ║`);
  console.log(`║ Regions:      ${REGION_TOTAL.toLocaleString().padStart(12)}               ║`);
  console.log(`║ Shipments/Drv: ${String(SHIPMENTS_PER_DRIVER).padStart(11)}               ║`);
  console.log('╚══════════════════════════════════════════════════╝');

  // Fetch all tenants
  console.log('\nFetching tenants...');
  const tenants = await prisma.$queryRaw<TenantInfo[]>`SELECT id, name FROM "Tenant" ORDER BY id`;
  console.log(`Found ${tenants.length.toLocaleString()} tenants\n`);

  // Count existing data
  const before: Record<string, number> = {};
  for (const t of ['Organization', 'Region', 'Branch', 'Shipment', 'TrackingEvent']) {
    const r = await prisma.$queryRawUnsafe<{ cnt: number }[]>(`SELECT COUNT(*)::int as cnt FROM "${t}"`);
    before[t] = r[0].cnt;
  }
  console.log('Before:');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k}: ${v.toLocaleString()}`);
  console.log('');

  // Execute phases
  await phase1Hierarchy(tenants);
  await phase2Regions(tenants);
  await phase3Shipments(tenants);

  // Count after
  console.log('\n=== SUMMARY ===\n');
  const after: Record<string, number> = {};
  for (const t of ['Organization', 'Region', 'Branch', 'Shipment', 'TrackingEvent', 'DeliveryAssignment']) {
    const r = await prisma.$queryRawUnsafe<{ cnt: number }[]>(`SELECT COUNT(*)::int as cnt FROM "${t}"`);
    after[t] = r[0].cnt;
  }

  console.log('After:');
  for (const [k, v] of Object.entries(after)) {
    const delta = v - (before[k] || 0);
    console.log(`  ${k}: ${v.toLocaleString()} (+${delta.toLocaleString()})`);
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nTotal rows inserted: ${totalRows.toLocaleString()}`);
  console.log(`Time: ${elapsed}s`);
  console.log(`Rate: ${Math.round(totalRows / Math.max(1, parseFloat(elapsed)))} rows/s`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
