const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const lognusId = 'cmsy9smw80005ch0kqd8lycmh';
  const count = await prisma.rolePermission.count({ where: { tenantId: lognusId } });
  console.log('RolePermissions for lognus:', count);
}

main().finally(() => prisma.$disconnect());
