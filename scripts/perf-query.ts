/**
 * Direct DB Query Performance Test
 * Run: npx tsx scripts/perf-query.ts
 *
 * Tests raw SQL query speed against PostgreSQL with 5M+ hierarchy rows.
 * No dev server required.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Result {
  label: string;
  rows: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  plan?: string;
}

function fmt(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function benchQuery(label: string, sql: string, params: any[] = [], runs = 7): Promise<Result> {
  const times: number[] = [];
  let rowCount = 0;

  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    const result = await prisma.$queryRawUnsafe(sql, ...params);
    const elapsed = performance.now() - start;
    times.push(elapsed);
    rowCount = Array.isArray(result) ? result.length : 0;
  }

  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;

  return {
    label,
    rows: rowCount,
    avgMs: avg,
    p50Ms: times[Math.floor(times.length * 0.5)],
    p95Ms: times[Math.floor(times.length * 0.95)],
    minMs: times[0],
    maxMs: times[times.length - 1],
  };
}

async function benchIndex(label: string, sql: string): Promise<string | null> {
  try {
    const result: any[] = await prisma.$queryRawUnsafe(`EXPLAIN (FORMAT JSON) ${sql}`);
    return JSON.stringify(result[0]['QUERY PLAN'], null, 0);
  } catch {
    return null;
  }
}

function printResult(r: Result) {
  const icon = r.avgMs < 100 ? '✅' : r.avgMs < 500 ? '⚠️' : '❌';
  console.log(`  ${icon} ${r.label}`);
  console.log(`     Rows: ${r.rows.toLocaleString()} | Avg: ${fmt(r.avgMs)} | P50: ${fmt(r.p50Ms)} | P95: ${fmt(r.p95Ms)} | Min: ${fmt(r.minMs)} | Max: ${fmt(r.maxMs)}`);
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   DTMS DB Query Performance Test                    ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // Count rows first
  console.log('▸ Counting rows...');
  const counts = await prisma.$queryRawUnsafe<{ table: string; count: bigint }[]>(`
    SELECT 'Organization' as "table", COUNT(*) as "count" FROM "Organization"
    UNION ALL SELECT 'Branch', COUNT(*) FROM "Branch"
    UNION ALL SELECT 'Region', COUNT(*) FROM "Region"
    UNION ALL SELECT 'Shipment', COUNT(*) FROM "Shipment"
    UNION ALL SELECT 'TrackingEvent', COUNT(*) FROM "TrackingEvent"
    UNION ALL SELECT 'Driver', COUNT(*) FROM "Driver"
    UNION ALL SELECT 'Vehicle', COUNT(*) FROM "Vehicle"
    UNION ALL SELECT 'GpsLog', COUNT(*) FROM "GpsLog"
    UNION ALL SELECT 'Tenant', COUNT(*) FROM "Tenant"
    UNION ALL SELECT 'User', COUNT(*) FROM "User"
  `);

  console.log('\n  Dataset:');
  for (const c of counts) {
    console.log(`    ${c.table}: ${Number(c.count).toLocaleString()}`);
  }

  const TENANT_ID = '357011aa-60f3-46cc-b3d6-7b5231c4747f';

  // ─── Phase 1: Hierarchy Queries ────────────────────────────
  console.log('\n━━━ Phase 1: Hierarchy Queries (Organization + Branch + Region) ━━━\n');

  const hierarchyResults: Result[] = [];

  hierarchyResults.push(await benchQuery(
    'SELECT * FROM Organization (no filter, LIMIT 20)',
    `SELECT * FROM "Organization" LIMIT 20`
  ));

  hierarchyResults.push(await benchQuery(
    'SELECT * FROM Organization WHERE tenantId = ? (LIMIT 20)',
    `SELECT * FROM "Organization" WHERE "tenantId" = $1 LIMIT 20`,
    [TENANT_ID]
  ));

  hierarchyResults.push(await benchQuery(
    'SELECT COUNT(*) FROM Organization WHERE tenantId = ?',
    `SELECT COUNT(*) as cnt FROM "Organization" WHERE "tenantId" = $1`,
    [TENANT_ID]
  ));

  hierarchyResults.push(await benchQuery(
    'SELECT * FROM Branch WHERE tenantId = ? (LIMIT 20)',
    `SELECT * FROM "Branch" WHERE "tenantId" = $1 LIMIT 20`,
    [TENANT_ID]
  ));

  hierarchyResults.push(await benchQuery(
    'SELECT COUNT(*) FROM Branch WHERE tenantId = ?',
    `SELECT COUNT(*) as cnt FROM "Branch" WHERE "tenantId" = $1`,
    [TENANT_ID]
  ));

  hierarchyResults.push(await benchQuery(
    'SELECT * FROM Region WHERE tenantId = ? (LIMIT 20)',
    `SELECT * FROM "Region" WHERE "tenantId" = $1 LIMIT 20`,
    [TENANT_ID]
  ));

  hierarchyResults.push(await benchQuery(
    'SELECT COUNT(*) FROM Region WHERE tenantId = ?',
    `SELECT COUNT(*) as cnt FROM "Region" WHERE "tenantId" = $1`,
    [TENANT_ID]
  ));

  // Deep hierarchy join
  hierarchyResults.push(await benchQuery(
    'Organization JOIN Branch ON tenantId (LIMIT 20)',
    `SELECT o."id" as "orgId", o."name" as "orgName", b."id" as "branchId", b."name" as "branchName"
     FROM "Organization" o
     JOIN "Branch" b ON b."tenantId" = o."tenantId"
     WHERE o."tenantId" = $1
     LIMIT 20`,
    [TENANT_ID]
  ));

  hierarchyResults.push(await benchQuery(
    'Organization + Branch + Region JOIN (LIMIT 20)',
    `SELECT o."name" as "org", b."name" as "branch", r."name" as "region"
     FROM "Organization" o
     JOIN "Branch" b ON b."tenantId" = o."tenantId"
     JOIN "Region" r ON r."tenantId" = o."tenantId"
     WHERE o."tenantId" = $1
     LIMIT 20`,
    [TENANT_ID]
  ));

  for (const r of hierarchyResults) printResult(r);

  // ─── Phase 2: Shipment Queries ────────────────────────────
  console.log('\n━━━ Phase 2: Shipment Queries (10M+ rows) ━━━━━━━━━━━━━━━━━━━━━━━\n');

  const shipmentResults: Result[] = [];

  shipmentResults.push(await benchQuery(
    'SELECT * FROM Shipment (no filter, LIMIT 20)',
    `SELECT * FROM "Shipment" LIMIT 20`
  ));

  shipmentResults.push(await benchQuery(
    'SELECT * FROM Shipment WHERE tenantId = ? (LIMIT 20)',
    `SELECT * FROM "Shipment" WHERE "tenantId" = $1 LIMIT 20`,
    [TENANT_ID]
  ));

  shipmentResults.push(await benchQuery(
    'SELECT COUNT(*) FROM Shipment WHERE tenantId = ?',
    `SELECT COUNT(*) as cnt FROM "Shipment" WHERE "tenantId" = $1`,
    [TENANT_ID]
  ));

  shipmentResults.push(await benchQuery(
    'Shipment + TrackingEvent JOIN (LIMIT 20)',
    `SELECT s."id", s."trackingNumber", s."status", te."status" as "eventStatus", te."createdAt"
     FROM "Shipment" s
     LEFT JOIN "TrackingEvent" te ON te."shipmentId" = s."id"
     WHERE s."tenantId" = $1
     LIMIT 20`,
    [TENANT_ID]
  ));

  shipmentResults.push(await benchQuery(
    'Shipment WHERE status = ? (LIMIT 20)',
    `SELECT * FROM "Shipment" WHERE "tenantId" = $1 AND "status" = 'IN_TRANSIT' LIMIT 20`,
    [TENANT_ID]
  ));

  shipmentResults.push(await benchQuery(
    'Shipment WHERE id = ? (PK lookup)',
    `SELECT * FROM "Shipment" WHERE "id" = $1`,
    ['00000000-0000-0000-0000-000000000001']
  ));

  for (const r of shipmentResults) printResult(r);

  // ─── Phase 3: TrackingEvent Queries ────────────────────────
  console.log('\n━━━ Phase 3: TrackingEvent Queries (400K+ rows) ━━━━━━━━━━━━━━━━━━\n');

  const trackingResults: Result[] = [];

  trackingResults.push(await benchQuery(
    'TrackingEvent WHERE shipmentId = ? (LIMIT 20)',
    `SELECT * FROM "TrackingEvent" WHERE "shipmentId" = $1 LIMIT 20`,
    ['00000000-0000-0000-0000-000000000001'] // random, likely no match → tests index
  ));

  trackingResults.push(await benchQuery(
    'TrackingEvent WHERE createdBy = ? (LIMIT 20)',
    `SELECT * FROM "TrackingEvent" WHERE "createdBy" = 'system' LIMIT 20`
  ));

  trackingResults.push(await benchQuery(
    'TrackingEvent COUNT by shipmentId',
    `SELECT "shipmentId", COUNT(*) as cnt FROM "TrackingEvent" GROUP BY "shipmentId" ORDER BY cnt DESC LIMIT 20`
  ));

  trackingResults.push(await benchQuery(
    'TrackingEvent + Shipment JOIN (LIMIT 20)',
    `SELECT te."id", te."status", te."latitude", te."longitude", s."trackingNumber"
     FROM "TrackingEvent" te
     JOIN "Shipment" s ON s."id" = te."shipmentId"
     WHERE te."createdBy" = 'system'
     LIMIT 20`
  ));

  for (const r of trackingResults) printResult(r);

  // ─── Phase 4: Driver + Vehicle Queries ────────────────────
  console.log('\n━━━ Phase 4: Driver + Vehicle Queries (10M each) ━━━━━━━━━━━━━━━━━\n');

  const driverResults: Result[] = [];

  driverResults.push(await benchQuery(
    'Driver WHERE tenantId = ? (LIMIT 20)',
    `SELECT * FROM "Driver" WHERE "tenantId" = $1 LIMIT 20`,
    [TENANT_ID]
  ));

  driverResults.push(await benchQuery(
    'Driver WHERE status = ? (LIMIT 20)',
    `SELECT * FROM "Driver" WHERE "status" = 'ACTIVE' LIMIT 20`
  ));

  driverResults.push(await benchQuery(
    'Vehicle WHERE tenantId = ? (LIMIT 20)',
    `SELECT * FROM "Vehicle" WHERE "tenantId" = $1 LIMIT 20`,
    [TENANT_ID]
  ));

  driverResults.push(await benchQuery(
    'Driver + Vehicle JOIN (LIMIT 20)',
    `SELECT d."id" as "driverId", d."name" as "driverName", v."id" as "vehicleId"
     FROM "Driver" d
     LEFT JOIN "Vehicle" v ON v."tenantId" = d."tenantId"
     WHERE d."tenantId" = $1
     LIMIT 20`,
    [TENANT_ID]
  ));

  for (const r of driverResults) printResult(r);

  // ─── Phase 5: Aggregate / Analytics Queries ────────────────
  console.log('\n━━━ Phase 5: Aggregate / Analytics Queries ━━━━━━━━━━━━━━━━━━━━━━━\n');

  const aggResults: Result[] = [];

  aggResults.push(await benchQuery(
    'COUNT(*) from all major tables (single query)',
    `SELECT
      (SELECT COUNT(*) FROM "Organization") as "orgs",
      (SELECT COUNT(*) FROM "Branch") as "branches",
      (SELECT COUNT(*) FROM "Region") as "regions",
      (SELECT COUNT(*) FROM "Shipment") as "shipments",
      (SELECT COUNT(*) FROM "TrackingEvent") as "events"
    `
  ));

  aggResults.push(await benchQuery(
    'Shipment status distribution (GROUP BY)',
    `SELECT "status", COUNT(*) as cnt FROM "Shipment" GROUP BY "status" ORDER BY cnt DESC`
  ));

  aggResults.push(await benchQuery(
    'Top 10 tenants by shipment count',
    `SELECT "tenantId", COUNT(*) as cnt FROM "Shipment" GROUP BY "tenantId" ORDER BY cnt DESC LIMIT 10`
  ));

  aggResults.push(await benchQuery(
    'Shipment per tenant (with HAVING)',
    `SELECT "tenantId", COUNT(*) as cnt FROM "Shipment" GROUP BY "tenantId" HAVING COUNT(*) > 100 ORDER BY cnt DESC LIMIT 10`
  ));

  for (const r of aggResults) printResult(r);

  // ─── Phase 6: Index Analysis ──────────────────────────────
  console.log('\n━━━ Phase 6: Index Usage (EXPLAIN) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const indexQueries = [
    ['Organization WHERE tenantId', `SELECT * FROM "Organization" WHERE "tenantId" = $1 LIMIT 20`],
    ['Branch WHERE tenantId', `SELECT * FROM "Branch" WHERE "tenantId" = $1 LIMIT 20`],
    ['Region WHERE tenantId', `SELECT * FROM "Region" WHERE "tenantId" = $1 LIMIT 20`],
    ['Shipment WHERE tenantId', `SELECT * FROM "Shipment" WHERE "tenantId" = $1 LIMIT 20`],
    ['Shipment WHERE trackingNumber', `SELECT * FROM "Shipment" WHERE "trackingNumber" = 'TRK000000000001'`],
    ['TrackingEvent WHERE shipmentId', `SELECT * FROM "TrackingEvent" WHERE "shipmentId" = $1 LIMIT 5`],
    ['Driver WHERE tenantId', `SELECT * FROM "Driver" WHERE "tenantId" = $1 LIMIT 20`],
    ['Vehicle WHERE tenantId', `SELECT * FROM "Vehicle" WHERE "tenantId" = $1 LIMIT 20`],
  ];

  for (const [label, sql] of indexQueries) {
    const plan = await benchIndex(label as string, sql);
    if (plan) {
      const usesIndex = plan.includes('Index') && !plan.includes('Seq Scan');
      const icon = usesIndex ? '✅' : '⚠️';
      console.log(`  ${icon} ${label}: ${usesIndex ? 'INDEX' : 'SEQ SCAN'}`);
    }
  }

  // ─── Summary ────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║                    SUMMARY                          ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const allResults = [...hierarchyResults, ...shipmentResults, ...trackingResults, ...driverResults, ...aggResults];
  const fast = allResults.filter(r => r.avgMs < 100).length;
  const medium = allResults.filter(r => r.avgMs >= 100 && r.avgMs < 500).length;
  const slow = allResults.filter(r => r.avgMs >= 500).length;

  console.log(`  Total queries tested: ${allResults.length}`);
  console.log(`  ✅ Fast (< 100ms): ${fast}`);
  console.log(`  ⚠️  Medium (100-500ms): ${medium}`);
  console.log(`  ❌ Slow (> 500ms): ${slow}`);
  console.log('');

  if (slow > 0) {
    console.log('  ⚠️  Slow queries that may need indexes:');
    for (const r of allResults.filter(r => r.avgMs >= 500)) {
      console.log(`    - ${r.label}: ${fmt(r.avgMs)}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
