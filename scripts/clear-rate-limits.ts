import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  // Clear all login rate limit blocks
  const cleared = await prisma.$executeRaw`DELETE FROM "LoginAttempt"`;
  console.log(`Deleted ${cleared} LoginAttempt rows`);
  // Verify no blocked accounts remain
  const blocked = await prisma.$executeRaw`SELECT COUNT(*) FROM "LoginAttempt" WHERE "blockedUntil" IS NOT NULL`;
  console.log(`Remaining blocked: ${blocked}`);
}
main().finally(() => prisma.$disconnect());
