/**
 * Generate GPS logs for live tracking
 * Creates 1 GPS log per driver with timestamps within last 2 hours
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient({ log: ['error'] });

const CITIES: Record<string, [number, number]> = {
  'Jakarta': [-6.2088, 106.8456],
  'Surabaya': [-7.2575, 112.7521],
  'Bandung': [-6.9175, 107.6191],
  'Medan': [3.5952, 98.6722],
  'Semarang': [-6.9666, 110.4196],
  'Makassar': [-5.1477, 119.4327],
  'Palembang': [-2.9761, 104.7754],
  'Tangerang': [-6.1781, 106.6319],
  'Depok': [-6.4025, 106.7942],
  'Bekasi': [-6.2349, 106.9916],
  'Yogyakarta': [-7.7956, 110.3695],
  'Denpasar': [-8.6500, 115.2167],
};

function randRange(base: number, range: number) {
  return base + (Math.random() - 0.5) * range;
}

function log(cur: number, total: number) {
  const pct = ((cur / total) * 100).toFixed(1);
  process.stdout.write(`\r[${pct}%] GPS logs: ${cur.toLocaleString()} / ${total.toLocaleString()}`);
}

async function main() {
  const t0 = Date.now();
  const BATCH = 5000;

  console.log('=== Generating GPS Logs ===\n');

  // Get drivers with tenant info (for location context)
  console.log('Fetching drivers...');
  const drivers = await prisma.$queryRawUnsafe<{ id: string; tenantId: string }[]>(
    `SELECT d.id, d."tenantId" FROM "Driver" d WHERE d.status = 'ACTIVE'`
  );
  console.log(`Found ${drivers.length.toLocaleString()} active drivers.\n`);

  // Get tenant cities
  const tenants = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "Tenant" ORDER BY id`
  );
  const tenantCities = tenants.map((t, i) => ({
    id: t.id,
    city: Object.keys(CITIES)[i % Object.keys(CITIES).length],
  }));
  const tenantCityMap = new Map(tenantCities.map(tc => [tc.id, tc.city]));

  // Create GPS logs — 1 per driver, timestamp within last 2 hours
  console.log('Creating GPS logs...');
  let created = 0;
  const now = Date.now();
  const twoHoursAgo = now - 2 * 60 * 60 * 1000;

  for (let i = 0; i < drivers.length; i += BATCH) {
    const batch = drivers.slice(i, i + BATCH);
    const values: string[] = [];

    for (const d of batch) {
      const cityName = tenantCityMap.get(d.tenantId) || 'Jakarta';
      const [baseLat, baseLng] = CITIES[cityName] || CITIES['Jakarta'];
      const lat = randRange(baseLat, 0.2).toFixed(6);
      const lng = randRange(baseLng, 0.2).toFixed(6);
      const speed = (Math.random() * 80).toFixed(1);
      const heading = Math.floor(Math.random() * 360);
      const accuracy = (Math.random() * 10 + 1).toFixed(1);
      const battery = Math.floor(Math.random() * 60 + 40);
      // Random timestamp within last 2 hours
      const ts = new Date(twoHoursAgo + Math.random() * 2 * 60 * 60 * 1000).toISOString();

      values.push(`('${randomUUID()}','${d.id}',${lat},${lng},${speed},${heading},${accuracy},${battery},'${ts}')`);
    }

    await prisma.$executeRawUnsafe(`
      INSERT INTO "GpsLog" ("id","driverId","latitude","longitude","speed","heading","accuracy","battery","createdAt")
      VALUES ${values.join(',')}
    `);

    created += batch.length;
    if (created % 50000 === 0 || created === drivers.length) {
      log(created, drivers.length);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const count: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "GpsLog"`);
  console.log(`\n\n=== DONE ===`);
  console.log(`GPS Logs: ${count[0].c.toLocaleString()}`);
  console.log(`Time: ${elapsed}s`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
