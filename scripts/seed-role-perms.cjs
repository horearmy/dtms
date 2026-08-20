const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const prisma = new PrismaClient();

async function main() {
  const t0 = Date.now();
  
  const permRow = await prisma.$queryRawUnsafe(`SELECT id FROM "Permission" WHERE code = '*'`);
  const permId = permRow[0]?.id;
  if (!permId) { console.error('No wildcard permission found!'); process.exit(1); }
  console.log('Wildcard permission id:', permId);
  
  const tenants = await prisma.$queryRawUnsafe(`SELECT id::text FROM "Tenant"`);
  console.log('Tenants:', tenants.length);
  
  const BATCH = 5000;
  let done = 0;
  
  for (let i = 0; i < tenants.length; i += BATCH) {
    const batch = tenants.slice(i, i + BATCH);
    const values = batch.map(t => `('${randomUUID()}','${t.id}','ADMIN_OPERASIONAL','${permId}')`).join(',');
    
    await prisma.$executeRawUnsafe(`
      INSERT INTO "RolePermission" (id, "tenantId", role, "permissionId")
      VALUES ${values}
    `);
    
    done += batch.length;
    process.stdout.write(`\r${done}/${tenants.length} tenants`);
  }
  
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "RolePermission"`);
  console.log(`\n\nDone! RolePermission rows: ${Number(count[0].c).toLocaleString()}`);
  console.log(`Time: ${elapsed}s`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
