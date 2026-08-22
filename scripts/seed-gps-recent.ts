import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const JAKARTA_CENTER = { lat: -6.2088, lng: 106.8456 };
const CITIES = [
  { lat: -6.2088, lng: 106.8456, name: 'Jakarta' },
  { lat: -6.9175, lng: 107.6191, name: 'Bandung' },
  { lat: -7.2575, lng: 112.7521, name: 'Surabaya' },
  { lat: -8.6705, lng: 115.2126, name: 'Bali' },
  { lat: -6.5944, lng: 106.7892, name: 'Bekasi' },
  { lat: -6.3032, lng: 106.6538, name: 'Tangerang' },
  { lat: -6.5765, lng: 106.7648, name: 'Depok' },
  { lat: -7.7956, lng: 110.3695, name: 'Yogyakarta' },
  { lat: -5.1477, lng: 119.4327, name: 'Makassar' },
  { lat: 0.5071, lng: 101.4478, name: 'Pekanbaru' },
];

async function main() {
  console.log('Fetching active drivers with tenantId...');

  const drivers = await prisma.driver.findMany({
    where: { status: 'ACTIVE', tenantId: { not: null } },
    select: { id: true, name: true, tenantId: true },
    take: 200,
  });

  if (drivers.length === 0) {
    console.log('No active drivers with tenantId found!');
    return;
  }

  console.log(`Found ${drivers.length} active drivers`);

  const now = Date.now();
  const points: Array<{
    driverId: string;
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    createdAt: Date;
  }> = [];

  for (const driver of drivers) {
    const city = CITIES[Math.floor(Math.random() * CITIES.length)];
    const numPoints = 3 + Math.floor(Math.random() * 5);

    for (let i = 0; i < numPoints; i++) {
      const offsetMs = Math.floor(Math.random() * 60 * 60 * 1000);
      const lat = city.lat + (Math.random() - 0.5) * 0.05;
      const lng = city.lng + (Math.random() - 0.5) * 0.05;
      const speed = Math.floor(Math.random() * 80);

      points.push({
        driverId: driver.id,
        latitude: lat,
        longitude: lng,
        speed,
        heading: Math.floor(Math.random() * 360),
        createdAt: new Date(now - offsetMs),
      });
    }
  }

  console.log(`Inserting ${points.length} GPS points...`);

  const BATCH = 5000;
  for (let i = 0; i < points.length; i += BATCH) {
    const batch = points.slice(i, i + BATCH);
    await prisma.gpsLog.createMany({ data: batch });
    process.stdout.write(`  ${Math.min(i + BATCH, points.length)}/${points.length}\r`);
  }

  console.log(`\nDone! Inserted ${points.length} GPS points for ${drivers.length} drivers`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
