const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.tenant.updateMany({
    where: { plan: 'BUSINESS' },
    data: { plan: 'PRO' },
  });
  console.log('Updated', result.count, 'tenants from BUSINESS to PRO');

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, plan: true } });
  console.log('All tenants:', JSON.stringify(tenants, null, 2));
}

main().finally(() => prisma.$disconnect());
