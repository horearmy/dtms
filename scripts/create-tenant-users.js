const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
  const prisma = new PrismaClient();

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, slug: true } });
  console.log('Tenants:', JSON.stringify(tenants, null, 2));

  const lognus = tenants.find(t => t.slug === 'logistik-nusantara');
  if (!lognus) { console.log('Tenant logistik-nusantara not found'); return; }

  const hash = (pw) => bcrypt.hashSync(pw, 10);

  const users = [
    { name: 'Admin Logistik Nusantara', username: 'lognus_admin', role: 'ADMIN_OPERASIONAL' },
    { name: 'Dispatcher LogNus', username: 'lognus_dispatcher', role: 'DISPATCHER' },
    { name: 'Warehouse LogNus', username: 'lognus_warehouse', role: 'WAREHOUSE' },
    { name: 'CS LogNus', username: 'lognus_cs', role: 'CUSTOMER_SERVICE' },
    { name: 'Supervisor LogNus', username: 'lognus_supervisor', role: 'SUPERVISOR' },
    { name: 'Management LogNus', username: 'lognus_mgmt', role: 'MANAGEMENT' },
  ];

  for (const u of users) {
    try {
      const created = await prisma.user.create({
        data: {
          name: u.name,
          username: u.username,
          passwordHash: hash('admin123'),
          role: Role[u.role],
          status: 'ACTIVE',
          tenantId: lognus.id,
          pwdVersion: 1,
          mustChangePassword: true,
        },
      });
      console.log(`Created: ${created.username} (${u.role})`);
    } catch (e) {
      console.log(`Skip ${u.username}: ${e.message?.slice(0, 80)}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
