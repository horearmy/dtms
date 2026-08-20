const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const perms = await p.$queryRawUnsafe('SELECT id, code FROM "Permission" ORDER BY code');
  console.log('Permissions:', JSON.stringify(perms));
  
  const rpCount = await p.$queryRawUnsafe('SELECT COUNT(*) as c FROM "RolePermission"');
  console.log('RolePermission count:', JSON.stringify(rpCount));
  
  const roles = await p.$queryRawUnsafe('SELECT DISTINCT role FROM "RolePermission"');
  console.log('Roles with perms:', JSON.stringify(roles));
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
