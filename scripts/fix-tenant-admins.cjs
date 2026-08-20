const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
  const prisma = new PrismaClient();
  const hash = await bcrypt.hash('admin123', 10);
  
  // Update first 10 tenant admin accounts
  const result = await prisma.$executeRawUnsafe(`
    UPDATE "User" 
    SET "passwordHash" = '${hash}'
    WHERE username LIKE 'admin%' AND role = 'ADMIN_OPERASIONAL'
  `);
  
  console.log(`Updated ${result} tenant admin passwords to: admin123`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
