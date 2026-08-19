const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sa = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });
  console.log('Before:', sa.tenantId);

  await prisma.user.update({
    where: { id: sa.id },
    data: { tenantId: null },
  });

  const updated = await prisma.user.findUnique({
    where: { id: sa.id },
    select: { id: true, name: true, username: true, role: true, tenantId: true },
  });
  console.log('After:', JSON.stringify(updated, null, 2));
}

main().finally(() => prisma.$disconnect());
