const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const users = await p.$queryRawUnsafe(
    `SELECT username, "tenantId"::text FROM "User" WHERE username IN ('admin00001','admin00002') ORDER BY username`
  );
  console.log(JSON.stringify(users));
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
