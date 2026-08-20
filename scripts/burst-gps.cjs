/**
 * Generate GPS logs for live tracking — pure SQL approach (no Prisma queryRaw)
 * Creates GPS logs distributed across 12 Indonesian cities
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error'] });

async function main() {
  const t0 = Date.now();
  const BATCH = 5000;

  console.log('=== Generating GPS Logs (pure SQL) ===\n');

  // 12 cities across Indonesia
  const CITIES = [
    { name: 'Jakarta',    lat: -6.2088, lng: 106.8456 },
    { name: 'Surabaya',   lat: -7.2575, lng: 112.7521 },
    { name: 'Bandung',    lat: -6.9175, lng: 107.6191 },
    { name: 'Medan',      lat: 3.5952,  lng: 98.6722 },
    { name: 'Semarang',   lat: -6.9666, lng: 110.4196 },
    { name: 'Makassar',   lat: -5.1477, lng: 119.4327 },
    { name: 'Palembang',  lat: -2.9761, lng: 104.7754 },
    { name: 'Tangerang',  lat: -6.1781, lng: 106.6319 },
    { name: 'Depok',      lat: -6.4025, lng: 106.7942 },
    { name: 'Bekasi',     lat: -6.2349, lng: 106.9916 },
    { name: 'Yogyakarta', lat: -7.7956, lng: 110.3695 },
    { name: 'Denpasar',   lat: -8.6500, lng: 115.2167 },
  ];

  // Use PostgreSQL to generate all GPS logs in one go
  // Assign each driver to a city based on row number mod 12
  console.log('Generating 1 GPS log per driver using SQL...');

  // Step 1: Count drivers
  const countResult = await prisma.$executeRawUnsafe(`SELECT COUNT(*) FROM "Driver" WHERE status = 'ACTIVE'`);
  console.log(`Active drivers: ~10M\n`);

  // Step 2: Use a single SQL to generate GPS data with random offsets
  // PostgreSQL generate_series approach
  for (let cityIdx = 0; cityIdx < CITIES.length; cityIdx++) {
    const city = CITIES[cityIdx];
    const spread = 0.1; // degree spread (~11km)

    console.log(`[${city.name}] Generating GPS logs...`);
    const t1 = Date.now();

    // This SQL:
    // 1. Gets drivers for this city (mod by city index)
    // 2. Generates random lat/lng offsets
    // 3. Creates GPS logs with timestamps in last 2 hours
    await prisma.$executeRawUnsafe(`
      INSERT INTO "GpsLog" ("id", "driverId", "latitude", "longitude", "speed", "heading", "accuracy", "battery", "createdAt")
      SELECT
        gen_random_uuid()::text,
        d.id,
        ROUND(($1 + (random() - 0.5) * $2 * 2)::numeric, 6)::double precision,
        ROUND(($3 + (random() - 0.5) * $4 * 2)::numeric, 6)::double precision,
        ROUND((random() * 80)::numeric, 1)::double precision,
        (random() * 360)::int,
        ROUND((random() * 10 + 1)::numeric, 1)::double precision,
        (random() * 60 + 40)::int,
        NOW() - (random() * interval '2 hours')
      FROM "Driver" d
      WHERE d.status = 'ACTIVE'
        AND d."tenantId" IN (
          SELECT t.id FROM "Tenant" t
          WHERE abs(('x' || substr(md5(t.id), 1, 8))::bit(32)::int) % $5 = $6
        )
    `, city.lat, spread, city.lng, spread, CITIES.length, cityIdx);

    const elapsed = ((Date.now() - t1) / 1000).toFixed(1);
    console.log(`  Done in ${elapsed}s`);
  }

  // Final count
  const total = await prisma.$executeRawUnsafe(`SELECT COUNT(*) FROM "GpsLog"`);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n=== DONE ===`);
  console.log(`Time: ${elapsed}s`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
