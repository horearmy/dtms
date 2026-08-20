/**
 * Burst Seed — 10,000,000 Drivers
 * Usage: npx tsx scripts/burst-drivers.ts
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient({ log: ['error'] });

const TARGET = 10_000_000;
const BATCH = 5000;

const FNames = ['Andi', 'Budi', 'Citra', 'Dewi', 'Eka', 'Fajar', 'Gita', 'Hadi', 'Indah', 'Joko',
  'Kartika', 'Lestari', 'Maya', 'Nurul', 'Putri', 'Rizky', 'Sari', 'Tono', 'Ulya', 'Wati'];
const LNames = ['Pratama', 'Sari', 'Wijaya', 'Putra', 'Saputra', 'Ramadhan', 'Hidayat',
  'Setiawan', 'Nugroho', 'Santoso', 'Kusuma', 'Wibowo'];

function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
function phone() { return '08' + String(Math.floor(Math.random() * 9000000000) + 1000000000); }
function esc(s: string) { return s.replace(/'/g, "''"); }

let t0 = Date.now();
function log(cur: number, total: number) {
  const pct = ((cur / total) * 100).toFixed(1);
  const sec = ((Date.now() - t0) / 1000).toFixed(0);
  const rate = Math.round(cur / (Date.now() - t0) * 1000);
  process.stdout.write(`\r[${pct}%] ${cur.toLocaleString()} / ${total.toLocaleString()} | ${rate.toLocaleString()}/s (${sec}s)`);
}

async function main() {
  t0 = Date.now();

  console.log('=== Burst: 10M Drivers ===\n');

  // Get existing tenant IDs
  console.log('Fetching tenants...');
  const tenants = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "Tenant" ORDER BY id`;
  console.log(`Found ${tenants.length} tenants.\n`);

  // Distribute drivers evenly across tenants
  const driversPerTenant = Math.ceil(TARGET / tenants.length);
  console.log(`Target: ${TARGET.toLocaleString()} drivers (${driversPerTenant.toLocaleString()} per tenant)\n`);

  // Clear existing drivers
  console.log('Clearing existing drivers...');
  await prisma.$executeRawUnsafe(`DELETE FROM "Driver"`);
  console.log('Done.\n');

  // Create drivers in batches
  console.log('Creating drivers...');
  let created = 0;

  for (let t = 0; t < tenants.length; t++) {
    const tenantId = tenants[t].id;
    const count = Math.min(driversPerTenant, TARGET - created);
    
    for (let i = 0; i < count; i += BATCH) {
      const batchCount = Math.min(BATCH, count - i);
      const values: string[] = [];
      
      for (let j = 0; j < batchCount; j++) {
        const idx = created + i + j;
        const name = esc(pick(FNames) + ' ' + pick(LNames));
        const empId = 'DRV' + String(idx + 1).padStart(8, '0');
        values.push(`('${randomUUID()}','${empId}','${name}','${phone()}','ACTIVE','${tenantId}')`);
      }

      await prisma.$executeRawUnsafe(`
        INSERT INTO "Driver" ("id","employeeId","name","phone","status","tenantId")
        VALUES ${values.join(',')}
      `);

      created += batchCount;
    }

    if ((t + 1) % 100 === 0 || t === tenants.length - 1) {
      log(created, TARGET);
    }
  }

  // Summary
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const count: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "Driver"`);
  console.log(`\n\n=== DONE ===`);
  console.log(`Drivers: ${count[0].c.toLocaleString()}`);
  console.log(`Time: ${elapsed}s`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
