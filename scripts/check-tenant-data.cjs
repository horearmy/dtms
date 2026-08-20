const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Check user admin00001
  const users = await prisma.$queryRawUnsafe(`SELECT id, username, "tenantId", role FROM "User" WHERE username = 'admin00001'`);
  console.log('User:', JSON.stringify(users));
  
  if (!users[0]) { console.log('User not found'); return; }
  const tid = users[0].tenantId;

  // 2. Check tenant
  const tenants = await prisma.$queryRawUnsafe(`SELECT id, name FROM "Tenant" WHERE id = $1`, tid);
  console.log('Tenant:', JSON.stringify(tenants));

  // 3. Count data for this tenant
  const drivers = await prisma.$queryRawUnsafe(`SELECT CAST(COUNT(*) AS INTEGER) as c FROM "Driver" WHERE "tenantId" = $1`, tid);
  console.log('Drivers:', JSON.stringify(drivers));

  const shipments = await prisma.$queryRawUnsafe(`SELECT CAST(COUNT(*) AS INTEGER) as c FROM "Shipment" WHERE "tenantId" = $1`, tid);
  console.log('Shipments:', JSON.stringify(shipments));

  const vehicles = await prisma.$queryRawUnsafe(`SELECT CAST(COUNT(*) AS INTEGER) as c FROM "Vehicle" WHERE "tenantId" = $1`, tid);
  console.log('Vehicles:', JSON.stringify(vehicles));

  const stats = await prisma.$queryRawUnsafe(`SELECT CAST(COUNT(*) AS INTEGER) as c FROM "Driver" WHERE "tenantId" = $1 AND status = 'ACTIVE'`, tid);
  console.log('Active drivers:', JSON.stringify(stats));

  console.log('\n--- Top 10 tenants by driver count ---');
  const topTenants = await prisma.$queryRawUnsafe(`SELECT "tenantId", CAST(COUNT(*) AS INTEGER) as c FROM "Driver" GROUP BY "tenantId" ORDER BY c DESC LIMIT 10`);
  console.log(JSON.stringify(topTenants));

  console.log('\n--- Sample drivers for this tenant ---');
  const sampleDrivers = await prisma.$queryRawUnsafe(`SELECT id, name, "tenantId", status FROM "Driver" WHERE "tenantId" = $1 LIMIT 5`, tid);
  console.log(JSON.stringify(sampleDrivers));

  console.log('\n--- Sample shipments (all tenants) ---');
  const sampleShipments = await prisma.$queryRawUnsafe(`SELECT id, "trackingNumber", "tenantId" FROM "Shipment" LIMIT 5`);
  console.log(JSON.stringify(sampleShipments));
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
