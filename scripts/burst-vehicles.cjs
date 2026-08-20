const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const prisma = new PrismaClient({ log: ['error'] });

const BATCH = 5000;

const TYPES = ['Box Truck', 'Van', 'Motorcycle', 'Pickup', 'Tronton', 'Trailer', 'Colt Diesel', 'Engkel'];
const STATUSES = ['AVAILABLE', 'IN_USE', 'MAINTENANCE'];
const PLATE_LETTERS = ['B','D','E','F','G','H','L','N','T','W'];
const PLATE_SUFFIX = ['ABC','DEF','GHI','JKL','MNO','PQR','STU','VWX','YZA','BCD'];

function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

let t0;
function log(cur, total) {
  const pct = ((cur / total) * 100).toFixed(1);
  const sec = ((Date.now() - t0) / 1000).toFixed(0);
  const rate = Math.round(cur / (Date.now() - t0) * 1000);
  process.stdout.write(`\r[${pct}%] ${cur.toLocaleString()} / ${total.toLocaleString()} | ${rate.toLocaleString()}/s (${sec}s)`);
}

async function main() {
  t0 = Date.now();

  console.log('=== Burst: 10M Vehicles (1K per tenant) ===\n');

  const tenants = await prisma.$queryRaw`SELECT id::text FROM "Tenant" ORDER BY id`;
  console.log(`Tenants: ${tenants.length}`);

  const TARGET = tenants.length * 1000;
  console.log(`Target: ${TARGET.toLocaleString()} vehicles\n`);

  // Clear existing
  console.log('Clearing existing vehicles...');
  await prisma.$executeRawUnsafe(`DELETE FROM "Vehicle"`);
  console.log('Done.\n');

  console.log('Creating vehicles...');
  let created = 0;

  for (let t = 0; t < tenants.length; t++) {
    const tenantId = tenants[t].id;
    
    for (let i = 0; i < 1000; i += BATCH) {
      const batchCount = Math.min(BATCH, 1000 - i);
      const values = [];
      
      for (let j = 0; j < batchCount; j++) {
        const globalIdx = created + i + j;
        const localIdx = i + j;
        // Unique plate: Letter + tenantSeq(5) + vehicleSeq(4) + suffix
        const tenantSeq = String(t + 1).padStart(5, '0');
        const vehicleSeq = String(localIdx + 1).padStart(4, '0');
        const plate = `${pick(PLATE_LETTERS)}${tenantSeq}${vehicleSeq}${pick(PLATE_SUFFIX)}`;
        const type = pick(TYPES);
        const capacity = 500 + (globalIdx % 14500);
        const status = STATUSES[globalIdx % 3];
        values.push(`('${randomUUID()}','${plate}','${type}',${capacity},'${status}','${tenantId}')`);
      }

      await prisma.$executeRawUnsafe(`
        INSERT INTO "Vehicle" ("id","vehicleNumber","type","capacity","status","tenantId")
        VALUES ${values.join(',')}
      `);

      created += batchCount;
    }

    if ((t + 1) % 200 === 0 || t === tenants.length - 1) {
      log(created, TARGET);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const count = await prisma.$queryRaw`SELECT COUNT(*) as c FROM "Vehicle"`;
  console.log(`\n\n=== DONE ===`);
  console.log(`Vehicles: ${Number(count[0].c).toLocaleString()}`);
  console.log(`Time: ${elapsed}s`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
