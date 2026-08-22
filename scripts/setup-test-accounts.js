/**
 * Setup test accounts for Testsprite performance testing.
 *
 * Creates / ensures the following accounts exist:
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ Role              │ Username         │ Password   │ Tenant      │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ SUPER_ADMIN       │ superadmin       │ Admin1234  │ (none)      │
 * │ ADMIN_OPERASIONAL │ logistik_admin   │ Admin1234  │ LogNus      │
 * │ DISPATCHER        │ logistik_disp    │ Admin1234  │ LogNus      │
 * │ WAREHOUSE         │ logistik_wh      │ Admin1234  │ LogNus      │
 * │ DRIVER            │ logistik_driver  │ Admin1234  │ LogNus      │
 * │ CUSTOMER_SERVICE  │ logistik_cs      │ Admin1234  │ LogNus      │
 * │ SUPERVISOR        │ logistik_super   │ Admin1234  │ LogNus      │
 * │ MANAGEMENT        │ logistik_mgmt    │ Admin1234  │ LogNus      │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Usage:
 *   node scripts/setup-test-accounts.js
 */

const { PrismaClient, Role, TenantStatus } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const BCRYPT_COST = 12;
const PASSWORD = 'Admin1234';

const prisma = new PrismaClient();

async function main() {
  console.log('=== DTMS Test Account Setup ===\n');

  // --- 1. Super Admin ---
  let superadmin = await prisma.user.findFirst({
    where: { username: 'superadmin', role: 'SUPER_ADMIN' },
  });
  if (!superadmin) {
    superadmin = await prisma.user.create({
      data: {
        name: 'Super Admin (Test)',
        username: 'superadmin',
        passwordHash: bcrypt.hashSync(PASSWORD, BCRYPT_COST),
        role: Role.SUPER_ADMIN,
        status: 'ACTIVE',
        pwdVersion: 1,
      },
    });
    console.log('[CREATED] Super Admin → superadmin / ' + PASSWORD);
  } else {
    // Ensure password is correct
    await prisma.user.update({
      where: { id: superadmin.id },
      data: { passwordHash: bcrypt.hashSync(PASSWORD, BCRYPT_COST), status: 'ACTIVE' },
    });
    console.log('[UPDATED] Super Admin → superadmin / ' + PASSWORD);
  }

  // --- 2. Logistik Nusantara Tenant ---
  let tenant = await prisma.tenant.findFirst({
    where: { slug: 'logistik-nusantara' },
  });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'PT Logistik Nusantara',
        slug: 'logistik-nusantara',
        code: 'LOGNUS',
        status: TenantStatus.ACTIVE,
        plan: 'ENTERPRISE',
        timezone: 'Asia/Jakarta',
        locale: 'id-ID',
        currency: 'IDR',
        maxUsers: 100,
        maxDrivers: 100,
        maxShipments: 10000,
        primaryColor: '#059669',
        secondaryColor: '#047857',
        accentColor: '#10b981',
        contactName: 'Admin Logistik Nusantara',
        contactEmail: 'admin@logistiknusantara.co.id',
      },
    });
    console.log('[CREATED] Tenant: PT Logistik Nusantara (' + tenant.id + ')');
  } else {
    // Ensure plan is ENTERPRISE for full feature testing
    if (tenant.plan !== 'ENTERPRISE') {
      await prisma.tenant.update({ where: { id: tenant.id }, data: { plan: 'ENTERPRISE' } });
      console.log('[UPDATED] Tenant plan → ENTERPRISE');
    } else {
      console.log('[EXISTS]  Tenant: PT Logistik Nusantara');
    }
  }

  // Ensure subscription exists
  const existingPlan = await prisma.plan.findUnique({ where: { code: 'ENTERPRISE' } });
  if (existingPlan) {
    const existingSub = await prisma.subscription.findFirst({ where: { tenantId: tenant.id } });
    if (!existingSub) {
      await prisma.subscription.create({
        data: { tenantId: tenant.id, planId: existingPlan.id, billingCycle: 'MONTHLY' },
      });
      console.log('[CREATED] Subscription: ENTERPRISE for LogNus');
    }
  }

  // Ensure RolePermission entries exist for this tenant
  const permCount = await prisma.rolePermission.count({ where: { tenantId: tenant.id } });
  if (permCount === 0) {
    console.log('[SEEDING] RolePermissions for LogNus...');
    const allPerms = await prisma.permission.findMany();
    const rolePerms = {
      ADMIN_OPERASIONAL: allPerms.filter(p => !['tenant.create', 'tenant.delete', 'tenant.update'].includes(p.code)),
      DISPATCHER: allPerms.filter(p => ['shipment.read', 'shipment.update', 'driver.read', 'driver.assign', 'vehicle.read', 'delivery.read', 'delivery.dispatch', 'delivery.start', 'delivery.complete', 'delivery.fail', 'delivery.reschedule', 'customer.read', 'warehouse.read', 'report.view', 'notification.read', 'notification.send'].includes(p.code)),
      WAREHOUSE: allPerms.filter(p => ['shipment.read', 'shipment.update', 'warehouse.read', 'warehouse.scan', 'warehouse.sort', 'driver.read', 'customer.read', 'report.view'].includes(p.code)),
      DRIVER: allPerms.filter(p => ['shipment.read', 'delivery.read', 'delivery.start', 'delivery.complete', 'delivery.fail', 'warehouse.read', 'warehouse.scan'].includes(p.code)),
      CUSTOMER_SERVICE: allPerms.filter(p => ['shipment.read', 'shipment.update', 'customer.read', 'customer.create', 'customer.update', 'delivery.read', 'delivery.reschedule', 'notification.read', 'notification.send', 'report.view'].includes(p.code)),
      SUPERVISOR: allPerms.filter(p => ['shipment.read', 'driver.read', 'driver.update', 'vehicle.read', 'vehicle.update', 'delivery.read', 'warehouse.read', 'report.view', 'report.export', 'audit.read', 'notification.read'].includes(p.code)),
      MANAGEMENT: allPerms.filter(p => ['shipment.read', 'shipment.export', 'driver.read', 'vehicle.read', 'customer.read', 'delivery.read', 'warehouse.read', 'report.view', 'report.export', 'notification.read'].includes(p.code)),
    };
    let count = 0;
    for (const [role, perms] of Object.entries(rolePerms)) {
      for (const perm of perms) {
        await prisma.rolePermission.upsert({
          where: { permissionId_role_tenantId: { permissionId: perm.id, role, tenantId: tenant.id } },
          update: {},
          create: { permissionId: perm.id, role, tenantId: tenant.id },
        }).catch(() => {});
        count++;
      }
    }
    console.log('[CREATED] ' + count + ' role-permission mappings');
  } else {
    console.log('[EXISTS]  RolePermissions (' + permCount + ' entries)');
  }

  // --- 3. Tenant User Accounts ---
  const accounts = [
    { username: 'logistik_admin',   name: 'Admin Logistik',     role: Role.ADMIN_OPERASIONAL },
    { username: 'logistik_disp',    name: 'Dispatcher Logistik', role: Role.DISPATCHER },
    { username: 'logistik_wh',      name: 'Staff Gudang',        role: Role.WAREHOUSE },
    { username: 'logistik_cs',      name: 'Customer Service',    role: Role.CUSTOMER_SERVICE },
    { username: 'logistik_super',   name: 'Supervisor Logistik', role: Role.SUPERVISOR },
    { username: 'logistik_mgmt',    name: 'Manajemen Logistik',  role: Role.MANAGEMENT },
  ];

  for (const acct of accounts) {
    let user = await prisma.user.findFirst({
      where: { username: acct.username, tenantId: tenant.id },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: acct.name,
          username: acct.username,
          passwordHash: bcrypt.hashSync(PASSWORD, BCRYPT_COST),
          role: acct.role,
          status: 'ACTIVE',
          tenantId: tenant.id,
          pwdVersion: 1,
        },
      });
      console.log('[CREATED] ' + acct.role.padEnd(22) + '→ ' + acct.username + ' / ' + PASSWORD);
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: bcrypt.hashSync(PASSWORD, BCRYPT_COST), status: 'ACTIVE', role: acct.role },
      });
      console.log('[UPDATED] ' + acct.role.padEnd(22) + '→ ' + acct.username + ' / ' + PASSWORD);
    }
  }

  // --- 4. Driver Account (needs Driver record too) ---
  const driverUsername = 'logistik_driver';
  let driverUser = await prisma.user.findFirst({
    where: { username: driverUsername, tenantId: tenant.id },
  });
  if (!driverUser) {
    driverUser = await prisma.user.create({
      data: {
        name: 'Driver Test',
        username: driverUsername,
        passwordHash: bcrypt.hashSync(PASSWORD, BCRYPT_COST),
        role: Role.DRIVER,
        status: 'ACTIVE',
        tenantId: tenant.id,
        phone: '081999888777',
        pwdVersion: 1,
      },
    });
    console.log('[CREATED] DRIVER → ' + driverUsername + ' / ' + PASSWORD);
  } else {
    await prisma.user.update({
      where: { id: driverUser.id },
      data: { passwordHash: bcrypt.hashSync(PASSWORD, BCRYPT_COST), status: 'ACTIVE' },
    });
    console.log('[UPDATED] DRIVER → ' + driverUsername + ' / ' + PASSWORD);
  }

  // Ensure Driver record exists
  let driverRecord = await prisma.driver.findFirst({ where: { userId: driverUser.id } });
  if (!driverRecord) {
    driverRecord = await prisma.driver.create({
      data: {
        employeeId: 'DRV-TEST',
        name: 'Driver Test',
        phone: '081999888777',
        userId: driverUser.id,
        tenantId: tenant.id,
      },
    });
    console.log('[CREATED] Driver record → DRV-TEST');
  } else {
    console.log('[EXISTS]  Driver record → ' + driverRecord.employeeId);
  }

  // --- 5. Seed hierarchy data for Logistik Nusantara ---
  const companyCount = await prisma.company.count({ where: { tenantId: tenant.id } });
  if (companyCount === 0) {
    console.log('[SEEDING] Hierarchy data...');
    const company = await prisma.company.create({
      data: { tenantId: tenant.id, name: 'Logistik Nusantara Corp', code: 'LNC', city: 'Jakarta', address: 'Jl. Jend. Sudirman Kav. 52-53', latitude: -6.2088, longitude: 106.8456 },
    });
    const branch = await prisma.branch.create({
      data: { tenantId: tenant.id, companyId: company.id, name: 'Cabang Jakarta Pusat', code: 'JKT-PUSAT', city: 'Jakarta', address: 'Jl. Thamrin No. 10', latitude: -6.1865, longitude: 106.8346 },
    });
    const branch2 = await prisma.branch.create({
      data: { tenantId: tenant.id, companyId: company.id, name: 'Cabang Bandung', code: 'BDG', city: 'Bandung', address: 'Jl. Asia Afrika No. 1', latitude: -6.9175, longitude: 107.6191 },
    });
    await prisma.department.create({ data: { tenantId: tenant.id, companyId: company.id, name: 'Operasional', code: 'OPS' } });
    await prisma.department.create({ data: { tenantId: tenant.id, companyId: company.id, name: 'Logistik', code: 'LOG' } });
    await prisma.warehouse.create({
      data: { tenantId: tenant.id, branchId: branch.id, name: 'Gudang Pusat', code: 'GDC-JKT', city: 'Jakarta', latitude: -6.213, longitude: 106.845, radiusMeters: 800 },
    });
    await prisma.hub.create({
      data: { tenantId: tenant.id, branchId: branch2.id, name: 'Hub Bandung', code: 'HUB-BDG', city: 'Bandung', latitude: -6.917, longitude: 107.619, radiusMeters: 800 },
    });
    console.log('[CREATED] Company, 2 branches, 2 departments, 1 warehouse, 1 hub');
  } else {
    console.log('[EXISTS]  Hierarchy data (' + companyCount + ' companies)');
  }

  // --- 6. Seed customers + sample shipments ---
  const custCount = await prisma.customer.count({ where: { tenantId: tenant.id } });
  if (custCount === 0) {
    console.log('[SEEDING] Customers + sample shipments...');
    const customers = await Promise.all([
      prisma.customer.create({ data: { name: 'PT Maju Jaya', phone: '021-5550101', email: 'ops@majujaya.co.id', address: 'Jl. Sudirman Kav 52', city: 'Jakarta', postalCode: '12190', tenantId: tenant.id } }),
      prisma.customer.create({ data: { name: 'CV Sinar Logistik', phone: '021-5550102', email: 'halo@sinarlogistik.com', address: 'Jl. Gatot Subroto No. 21', city: 'Jakarta', postalCode: '12930', tenantId: tenant.id } }),
      prisma.customer.create({ data: { name: 'Toko Elektronik Sentral', phone: '022-5550103', email: 'sentral@gmail.com', address: 'Jl. Braga No. 12', city: 'Bandung', postalCode: '40111', tenantId: tenant.id } }),
      prisma.customer.create({ data: { name: 'Rumah Sakit Sehat', phone: '031-5550104', email: 'logistik@rssehat.co.id', address: 'Jl. Ahmad Yani No. 88', city: 'Surabaya', postalCode: '60231', tenantId: tenant.id } }),
    ]);
    console.log('[CREATED] 4 customers');
  } else {
    console.log('[EXISTS]  Customers (' + custCount + ' records)');
  }

  // --- 7. Vehicles ---
  const vehCount = await prisma.vehicle.count({ where: { tenantId: tenant.id } });
  if (vehCount === 0) {
    await Promise.all([
      prisma.vehicle.create({ data: { vehicleNumber: 'B 1111 LN', type: 'Pickup', capacity: 1000, status: 'AVAILABLE', tenantId: tenant.id } }),
      prisma.vehicle.create({ data: { vehicleNumber: 'B 2222 LN', type: 'Truck Box', capacity: 5000, status: 'AVAILABLE', tenantId: tenant.id } }),
      prisma.vehicle.create({ data: { vehicleNumber: 'B 3333 LN', type: 'Van', capacity: 800, status: 'AVAILABLE', tenantId: tenant.id } }),
    ]);
    console.log('[CREATED] 3 vehicles');
  } else {
    console.log('[EXISTS]  Vehicles (' + vehCount + ' records)');
  }

  console.log('\n=== Test Accounts Ready ===\n');
  console.log('┌─────────────────────┬──────────────────┬──────────┬──────────────────────┐');
  console.log('│ Role                │ Username         │ Password │ URL Path             │');
  console.log('├─────────────────────┼──────────────────┼──────────┼──────────────────────┤');
  console.log('│ SUPER_ADMIN         │ superadmin       │ Admin1234│ /tenants             │');
  console.log('│ ADMIN_OPERASIONAL   │ logistik_admin   │ Admin1234│ /dashboard           │');
  console.log('│ DISPATCHER          │ logistik_disp    │ Admin1234│ /dispatch            │');
  console.log('│ WAREHOUSE           │ logistik_wh      │ Admin1234│ /warehouses          │');
  console.log('│ DRIVER              │ logistik_driver  │ Admin1234│ /driver              │');
  console.log('│ CUSTOMER_SERVICE    │ logistik_cs      │ Admin1234│ /customers           │');
  console.log('│ SUPERVISOR          │ logistik_super   │ Admin1234│ /reports             │');
  console.log('│ MANAGEMENT          │ logistik_mgmt    │ Admin1234│ /analytics           │');
  console.log('└─────────────────────┴──────────────────┴──────────┴──────────────────────┘');
  console.log('\nBase URL: http://localhost:3000');
  console.log('Login URL: http://localhost:3000/login');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
