const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  // Test password directly
  const user = await prisma.$queryRawUnsafe(
    `SELECT id, username, "passwordHash", "tenantId", role FROM "User" WHERE username = 'admin00001'`
  );
  if (!user[0]) { console.log('User not found'); return; }
  
  console.log('User:', JSON.stringify({ ...user[0], passwordHash: user[0].passwordHash.substring(0, 20) + '...' }));
  
  const match = await bcrypt.compare('admin123', user[0].passwordHash);
  console.log('Password matches:', match);

  // Also re-hash and update all tenant admins to be safe
  const hash = await bcrypt.hash('admin123', 10);
  const count = await prisma.$executeRawUnsafe(
    `UPDATE "User" SET "passwordHash" = $1 WHERE username LIKE 'admin%' AND role = 'ADMIN_OPERASIONAL'`,
    hash
  );
  console.log(`Updated ${count} users with fresh hash`);

  // Clear all login attempts
  await prisma.$executeRawUnsafe(`DELETE FROM "LoginAttempt"`);
  console.log('Cleared login attempts');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
