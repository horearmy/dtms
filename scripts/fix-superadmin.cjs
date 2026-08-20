const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

async function main() {
  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash('admin123', 10);
  
  await prisma.$executeRawUnsafe(`
    INSERT INTO "User" ("id", "username", "passwordHash", "name", "email", "role", "status", "provider", "pwdVersion", "mustChangePassword", "createdAt")
    VALUES ('${randomUUID()}', 'superadmin', '${passwordHash}', 'Super Admin', 'super@dtms.com', 'SUPER_ADMIN', 'ACTIVE', 'LOCAL', 1, false, now())
    ON CONFLICT DO NOTHING
  `);
  
  console.log('Superadmin created! username: superadmin, password: admin123');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
