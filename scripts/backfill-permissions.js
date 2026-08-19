const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// All permission codes from src/lib/permissions.ts
const ALL_PERMISSIONS = [
  'tenant.read', 'tenant.create', 'tenant.update', 'tenant.delete',
  'user.read', 'user.create', 'user.update', 'user.delete',
  'driver.read', 'driver.create', 'driver.update', 'driver.delete', 'driver.assign',
  'vehicle.read', 'vehicle.create', 'vehicle.update', 'vehicle.delete',
  'customer.read', 'customer.create', 'customer.update', 'customer.delete',
  'shipment.read', 'shipment.create', 'shipment.update', 'shipment.cancel', 'shipment.assign', 'shipment.export',
  'delivery.read', 'delivery.dispatch', 'delivery.start', 'delivery.complete', 'delivery.fail', 'delivery.reschedule',
  'warehouse.read', 'warehouse.scan', 'warehouse.sort', 'warehouse.update',
  'report.view', 'report.export',
  'audit.read',
  'geofence.read', 'geofence.create', 'geofence.update', 'geofence.delete',
  'notification.read', 'notification.send',
  'organization.read', 'organization.create', 'organization.update', 'organization.delete',
  'settings.read', 'settings.update', 'settings.delete',
  'sla.read', 'sla.create', 'sla.update', 'sla.delete',
  'exception.read', 'exception.create', 'exception.update', 'exception.assign',
  'analytics.view',
  'control_tower.view',
  'dispatch.view', 'dispatch.assign',
  'integration.read', 'integration.create', 'integration.update', 'integration.delete',
  'webhook.read', 'webhook.create', 'webhook.update', 'webhook.delete',
  'api_key.read', 'api_key.create', 'api_key.delete',
  'billing.read', 'billing.manage',
  'gps.send', 'gps.read',
  'file.read', 'file.upload',
  'daily_report.read', 'daily_report.create',
];

const SUPER_ADMIN_PERMS = ['*'];
const ADMIN_OPERASIONAL_PERMS = [
  'user.read', 'user.create', 'user.update',
  'driver.read', 'driver.create', 'driver.update', 'driver.assign',
  'vehicle.read', 'vehicle.create', 'vehicle.update',
  'customer.read', 'customer.create', 'customer.update',
  'shipment.read', 'shipment.create', 'shipment.update', 'shipment.cancel', 'shipment.assign', 'shipment.export',
  'delivery.read', 'delivery.dispatch', 'delivery.start', 'delivery.complete', 'delivery.fail', 'delivery.reschedule',
  'warehouse.read', 'warehouse.scan', 'warehouse.sort',
  'report.view', 'report.export',
  'audit.read', 'geofence.read', 'geofence.create', 'geofence.update',
  'notification.read', 'notification.send',
  'organization.read', 'organization.create', 'organization.update',
  'settings.read', 'settings.update',
  'billing.read', 'billing.manage',
  'sla.read', 'sla.create', 'sla.update', 'sla.delete',
  'exception.read', 'exception.create', 'exception.update', 'exception.assign',
  'analytics.view', 'control_tower.view',
  'dispatch.view', 'dispatch.assign',
  'integration.read', 'integration.create',
  'webhook.read', 'webhook.create',
  'api_key.read', 'api_key.create',
  'gps.send', 'gps.read',
  'file.read', 'file.upload',
  'daily_report.read', 'daily_report.create',
];

const ROLE_PERMS = {
  SUPER_ADMIN: SUPER_ADMIN_PERMS,
  ADMIN_OPERASIONAL: ADMIN_OPERASIONAL_PERMS,
  DISPATCHER: [
    'shipment.read', 'shipment.update',
    'driver.read', 'driver.assign', 'vehicle.read',
    'delivery.read', 'delivery.dispatch', 'delivery.start', 'delivery.complete', 'delivery.fail', 'delivery.reschedule',
    'customer.read', 'warehouse.read', 'report.view', 'notification.read', 'notification.send',
  ],
  WAREHOUSE: [
    'shipment.read', 'shipment.update',
    'warehouse.read', 'warehouse.scan', 'warehouse.sort',
    'driver.read', 'customer.read', 'report.view',
  ],
  SUPERVISOR: [
    'shipment.read', 'driver.read', 'driver.update',
    'vehicle.read', 'vehicle.update',
    'delivery.read', 'warehouse.read', 'report.view', 'report.export', 'audit.read', 'notification.read',
  ],
  MANAGEMENT: [
    'shipment.read', 'shipment.export', 'driver.read', 'vehicle.read', 'customer.read',
    'delivery.read', 'warehouse.read', 'report.view', 'report.export', 'notification.read',
  ],
  CUSTOMER_SERVICE: [
    'shipment.read', 'shipment.update',
    'customer.read', 'customer.create', 'customer.update',
    'delivery.read', 'delivery.reschedule', 'notification.read', 'notification.send', 'report.view',
  ],
  DRIVER: [
    'shipment.read', 'delivery.read', 'delivery.start', 'delivery.complete', 'delivery.fail',
    'warehouse.read', 'warehouse.scan',
  ],
  CUSTOMER: ['shipment.read', 'notification.read'],
};

async function main() {
  console.log('=== Backfill Permissions ===\n');

  // 1. Ensure all Permission records exist
  let created = 0;
  for (const code of ALL_PERMISSIONS) {
    const [resource, action] = code.split('.');
    const existing = await prisma.permission.findUnique({ where: { code } });
    if (!existing) {
      await prisma.permission.create({ data: { code, resource, action, label: `${resource}.${action}` } });
      created++;
    }
  }
  console.log(`Permissions: ${created} created, ${ALL_PERMISSIONS.length - created} already existed`);

  // 2. Ensure all tenants have RolePermission entries for SUPER_ADMIN with '*'
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  let rpCreated = 0;

  for (const tenant of tenants) {
    // Get the wildcard permission record (SUPER_ADMIN uses '*')
    const wildcardPerm = await prisma.permission.findFirst({ where: { code: '*' } });
    if (!wildcardPerm) {
      console.log('Creating wildcard permission...');
      await prisma.permission.create({ data: { code: '*', resource: '*', action: '*', label: 'Wildcard (all permissions)' } });
    }
    const perm = wildcardPerm || await prisma.permission.findFirst({ where: { code: '*' } });

    // SUPER_ADMIN: assign wildcard
    const existingSuperAdminRP = await prisma.rolePermission.findFirst({
      where: { role: 'SUPER_ADMIN', tenantId: tenant.id, permissionId: perm.id },
    });
    if (!existingSuperAdminRP) {
      await prisma.rolePermission.create({ data: { role: 'SUPER_ADMIN', tenantId: tenant.id, permissionId: perm.id } });
      rpCreated++;
    }

    // Other roles
    for (const [role, perms] of Object.entries(ROLE_PERMS)) {
      if (role === 'SUPER_ADMIN') continue;
      for (const permCode of perms) {
        const permRec = await prisma.permission.findUnique({ where: { code: permCode } });
        if (!permRec) continue;
        const existing = await prisma.rolePermission.findFirst({
          where: { role, tenantId: tenant.id, permissionId: permRec.id },
        });
        if (!existing) {
          await prisma.rolePermission.create({ data: { role, tenantId: tenant.id, permissionId: permRec.id } });
          rpCreated++;
        }
      }
    }
  }
  console.log(`RolePermissions: ${rpCreated} created for ${tenants.length} tenant(s)\n`);
  console.log('Done!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
