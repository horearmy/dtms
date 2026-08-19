const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.loginAttempt.deleteMany().then(function(r) {
  console.log('Cleared:', r.count, 'attempts');
  return p.$disconnect();
});
