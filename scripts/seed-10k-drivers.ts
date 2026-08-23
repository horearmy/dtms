import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const CITIES = [
  { lat: -6.2088, lng: 106.8456 }, { lat: -6.9175, lng: 107.6191 },
  { lat: -7.2575, lng: 112.7521 }, { lat: -8.6705, lng: 115.2126 },
  { lat: -6.5944, lng: 106.7892 }, { lat: -6.3032, lng: 106.6538 },
  { lat: -6.5765, lng: 107.6048 }, { lat: -7.7956, lng: 110.3695 },
  { lat: -5.1477, lng: 119.4327 }, { lat: 0.5071, lng: 101.4478 },
  { lat: -3.3186, lng: 114.5944 }, { lat: -6.1751, lng: 106.8650 },
  { lat: -7.3088, lng: 112.7364 }, { lat: -8.1517, lng: 113.6852 },
  { lat: -6.9930, lng: 110.4203 }, { lat: -6.2349, lng: 106.8466 },
  { lat: -7.5361, lng: 112.7498 }, { lat: -6.8896, lng: 107.6130 },
  { lat: -8.4095, lng: 115.1889 }, { lat: -2.9761, lng: 104.7754 },
];

const NAMES = [
  'Ahmad', 'Budi', 'Citra', 'Dedi', 'Eka', 'Fajar', 'Gilang', 'Hendra',
  'Iwan', 'Joko', 'Kartika', 'Lina', 'Maya', 'Nurul', 'Omar', 'Putri',
  'Rudi', 'Sari', 'Tono', 'Umi', 'Vina', 'Wahyu', 'Yanti', 'Zaki',
  'Agus', 'Bayu', 'Deni', 'Erfan', 'Fitri', 'Gina', 'Hadi', 'Indah',
];

function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function main() {
  const BATCH = 5000;
  const totalDrivers = 10000;
  const existingCount = await prisma.driver.count();
  console.log(`Existing drivers: ${existingCount}`);

  const tenants = await prisma.tenant.findMany({ select: { id: true }, take: 5 });
  if (tenants.length === 0) { console.log('No tenants!'); return; }

  console.log(`Using ${tenants.length} tenants, creating ${totalDrivers} drivers...`);

  const now = Date.now();
  const driverBatch: Array<{
    id: string; employeeId: string; name: string; phone: string;
    status: string; tenantId: string;
  }> = [];
  const gpsBatch: Array<{
    driverId: string; latitude: number; longitude: number;
    speed: number; heading: number; createdAt: Date;
  }> = [];

  for (let i = 0; i < totalDrivers; i++) {
    const id = `drv-${String(i + existingCount + 1).padStart(6, '0')}`;
    const tenant = tenants[i % tenants.length];
    const name = `${NAMES[i % NAMES.length]} ${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i * 7) % 26))}`;
    const city = CITIES[i % CITIES.length];

    driverBatch.push({
      id,
      employeeId: `EMP${String(i + 1).padStart(6, '0')}`,
      name,
      phone: `08${String(randInt(1000000000, 9999999999))}`,
      status: 'ACTIVE',
      tenantId: tenant.id,
    });

    const numPoints = 3 + randInt(0, 4);
    for (let j = 0; j < numPoints; j++) {
      gpsBatch.push({
        driverId: id,
        latitude: city.lat + (Math.random() - 0.5) * 0.08,
        longitude: city.lng + (Math.random() - 0.5) * 0.08,
        speed: randInt(0, 80),
        heading: randInt(0, 360),
        createdAt: new Date(now - randInt(0, 60 * 60 * 1000)),
      });
    }
  }

  console.log(`Inserting ${driverBatch.length} drivers...`);
  for (let i = 0; i < driverBatch.length; i += BATCH) {
    const batch = driverBatch.slice(i, i + BATCH);
    await prisma.driver.createMany({ data: batch, skipDuplicates: true });
    process.stdout.write(`  Drivers: ${Math.min(i + BATCH, driverBatch.length)}/${driverBatch.length}\r`);
  }
  console.log('');

  console.log(`Inserting ${gpsBatch.length} GPS points...`);
  for (let i = 0; i < gpsBatch.length; i += BATCH) {
    const batch = gpsBatch.slice(i, i + BATCH);
    await prisma.gpsLog.createMany({ data: batch });
    process.stdout.write(`  GPS: ${Math.min(i + BATCH, gpsBatch.length)}/${gpsBatch.length}\r`);
  }
  console.log('');

  const totalDriversNow = await prisma.driver.count({ where: { status: 'ACTIVE', tenantId: { not: null } } });
  const hourAgo = new Date(now - 60 * 60 * 1000);
  const recentGps = await prisma.gpsLog.count({ where: { createdAt: { gte: hourAgo } } });
  console.log(`\nDone! Total ACTIVE drivers: ${totalDriversNow}, GPS points last hour: ${recentGps}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
