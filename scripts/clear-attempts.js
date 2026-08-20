const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$executeRawUnsafe('DELETE FROM "LoginAttempt"')
  .then(() => { console.log('cleared'); return p.$disconnect(); })
  .catch(e => { console.error(e); p.$disconnect(); });
