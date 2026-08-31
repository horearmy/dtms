export const PERMISSIONS = {
  TENANT: {
    READ: 'tenant.read',
    CREATE: 'tenant.create',
    UPDATE: 'tenant.update',
    DELETE: 'tenant.delete',
  },
  USER: {
    READ: 'user.read',
    CREATE: 'user.create',
    UPDATE: 'user.update',
    DELETE: 'user.delete',
  },
  DRIVER: {
    READ: 'driver.read',
    CREATE: 'driver.create',
    UPDATE: 'driver.update',
    DELETE: 'driver.delete',
    ASSIGN: 'driver.assign',
  },
  VEHICLE: {
    READ: 'vehicle.read',
    CREATE: 'vehicle.create',
    UPDATE: 'vehicle.update',
    DELETE: 'vehicle.delete',
  },
  CUSTOMER: {
    READ: 'customer.read',
    CREATE: 'customer.create',
    UPDATE: 'customer.update',
    DELETE: 'customer.delete',
  },
  SHIPMENT: {
    READ: 'shipment.read',
    CREATE: 'shipment.create',
    UPDATE: 'shipment.update',
    CANCEL: 'shipment.cancel',
    ASSIGN: 'shipment.assign',
    EXPORT: 'shipment.export',
  },

  DELIVERY: {
    READ: 'delivery.read',
    DISPATCH: 'delivery.dispatch',
    START: 'delivery.start',
    COMPLETE: 'delivery.complete',
    FAIL: 'delivery.fail',
    RESCHEDULE: 'delivery.reschedule',
  },
  WAREHOUSE: {
    READ: 'warehouse.read',
    CREATE: 'warehouse.create',
    UPDATE: 'warehouse.update',
    DELETE: 'warehouse.delete',
    SCAN: 'warehouse.scan',
    SORT: 'warehouse.sort',
  },
  REPORT: {
    VIEW: 'report.view',
    EXPORT: 'report.export',
  },
  AUDIT: {
    READ: 'audit.read',
  },
  GEOFENCE: {
    READ: 'geofence.read',
    CREATE: 'geofence.create',
    UPDATE: 'geofence.update',
    DELETE: 'geofence.delete',
  },
  NOTIFICATION: {
    READ: 'notification.read',
    SEND: 'notification.send',
  },
  ORGANIZATION: {
    READ: 'organization.read',
    CREATE: 'organization.create',
    UPDATE: 'organization.update',
    DELETE: 'organization.delete',
  },
  REGION: {
    READ: 'region.read',
    CREATE: 'region.create',
    UPDATE: 'region.update',
    DELETE: 'region.delete',
  },
  BRANCH: {
    READ: 'branch.read',
    CREATE: 'branch.create',
    UPDATE: 'branch.update',
    DELETE: 'branch.delete',
  },
  DEPARTMENT: {
    READ: 'department.read',
    CREATE: 'department.create',
    UPDATE: 'department.update',
    DELETE: 'department.delete',
  },
  HUB: {
    READ: 'hub.read',
    CREATE: 'hub.create',
    UPDATE: 'hub.update',
    DELETE: 'hub.delete',
  },
  SETTINGS: {
    READ: 'settings.read',
    UPDATE: 'settings.update',
    DELETE: 'settings.delete',
  },
  SLA: {
    READ: 'sla.read',
    CREATE: 'sla.create',
    UPDATE: 'sla.update',
    DELETE: 'sla.delete',
  },
  EXCEPTION: {
    READ: 'exception.read',
    CREATE: 'exception.create',
    UPDATE: 'exception.update',
    ASSIGN: 'exception.assign',
  },
  ANALYTICS: {
    VIEW: 'analytics.view',
  },
  CONTROL_TOWER: {
    VIEW: 'control_tower.view',
  },
  DISPATCH: {
    VIEW: 'dispatch.view',
    ASSIGN: 'dispatch.assign',
  },
  INTEGRATION: {
    READ: 'integration.read',
    CREATE: 'integration.create',
    UPDATE: 'integration.update',
    DELETE: 'integration.delete',
  },
  WEBHOOK: {
    READ: 'webhook.read',
    CREATE: 'webhook.create',
    UPDATE: 'webhook.update',
    DELETE: 'webhook.delete',
  },
  API_KEY: {
    READ: 'api_key.read',
    CREATE: 'api_key.create',
    DELETE: 'api_key.delete',
  },
  BILLING: {
    READ: 'billing.read',
    MANAGE: 'billing.manage',
  },
  GPS: {
    SEND: 'gps.send',
    READ: 'gps.read',
  },
  FILE: {
    READ: 'file.read',
    UPLOAD: 'file.upload',
  },
  DAILY_REPORT: {
    READ: 'daily_report.read',
    CREATE: 'daily_report.create',
  },
} as const;

const P = PERMISSIONS;

export const ROLE_PERMS: Record<string, string[]> = {
  ADMIN_OPERASIONAL: [
    P.USER.READ, P.USER.CREATE, P.USER.UPDATE,
    P.DRIVER.READ, P.DRIVER.CREATE, P.DRIVER.UPDATE, P.DRIVER.ASSIGN,
    P.VEHICLE.READ, P.VEHICLE.CREATE, P.VEHICLE.UPDATE,
    P.CUSTOMER.READ, P.CUSTOMER.CREATE, P.CUSTOMER.UPDATE,
    P.SHIPMENT.READ, P.SHIPMENT.CREATE, P.SHIPMENT.UPDATE, P.SHIPMENT.CANCEL, P.SHIPMENT.ASSIGN, P.SHIPMENT.EXPORT,
    P.DELIVERY.READ, P.DELIVERY.DISPATCH, P.DELIVERY.START, P.DELIVERY.COMPLETE, P.DELIVERY.FAIL, P.DELIVERY.RESCHEDULE,
    P.WAREHOUSE.READ, P.WAREHOUSE.CREATE, P.WAREHOUSE.UPDATE, P.WAREHOUSE.DELETE, P.WAREHOUSE.SCAN, P.WAREHOUSE.SORT,
    P.REPORT.VIEW, P.REPORT.EXPORT,
    P.AUDIT.READ, P.GEOFENCE.READ, P.GEOFENCE.CREATE, P.GEOFENCE.UPDATE,
    P.NOTIFICATION.READ, P.NOTIFICATION.SEND,
    P.ORGANIZATION.READ, P.ORGANIZATION.CREATE, P.ORGANIZATION.UPDATE,
    P.REGION.READ, P.REGION.CREATE, P.REGION.UPDATE,
    P.BRANCH.READ, P.BRANCH.CREATE, P.BRANCH.UPDATE,
    P.DEPARTMENT.READ, P.DEPARTMENT.CREATE, P.DEPARTMENT.UPDATE,
    P.HUB.READ, P.HUB.CREATE, P.HUB.UPDATE,
    P.SETTINGS.READ, P.SETTINGS.UPDATE, P.SETTINGS.DELETE,
    P.BILLING.READ, P.BILLING.MANAGE,
    P.SLA.READ, P.SLA.CREATE, P.SLA.UPDATE, P.SLA.DELETE,
    P.EXCEPTION.READ, P.EXCEPTION.CREATE, P.EXCEPTION.UPDATE, P.EXCEPTION.ASSIGN,
    P.ANALYTICS.VIEW, P.CONTROL_TOWER.VIEW,
    P.DISPATCH.VIEW, P.DISPATCH.ASSIGN,
    P.INTEGRATION.READ, P.INTEGRATION.CREATE,
    P.WEBHOOK.READ, P.WEBHOOK.CREATE,
    P.API_KEY.READ, P.API_KEY.CREATE,
    P.GPS.SEND, P.GPS.READ, P.FILE.READ, P.FILE.UPLOAD,
    P.DAILY_REPORT.READ, P.DAILY_REPORT.CREATE,
  ],
  DISPATCHER: [
    P.SHIPMENT.READ, P.SHIPMENT.UPDATE,
    P.DRIVER.READ, P.DRIVER.ASSIGN, P.VEHICLE.READ,
    P.DELIVERY.READ, P.DELIVERY.DISPATCH, P.DELIVERY.START, P.DELIVERY.COMPLETE, P.DELIVERY.FAIL, P.DELIVERY.RESCHEDULE,
    P.CUSTOMER.READ, P.WAREHOUSE.READ, P.REPORT.VIEW, P.NOTIFICATION.READ, P.NOTIFICATION.SEND,
  ],
  WAREHOUSE: [
    P.SHIPMENT.READ, P.SHIPMENT.UPDATE,
    P.WAREHOUSE.READ, P.WAREHOUSE.SCAN, P.WAREHOUSE.SORT,
    P.DRIVER.READ, P.CUSTOMER.READ, P.REPORT.VIEW,
  ],
  SUPERVISOR: [
    P.SHIPMENT.READ, P.DRIVER.READ, P.DRIVER.UPDATE,
    P.VEHICLE.READ, P.VEHICLE.UPDATE,
    P.DELIVERY.READ, P.WAREHOUSE.READ, P.REPORT.VIEW, P.REPORT.EXPORT, P.AUDIT.READ, P.NOTIFICATION.READ,
  ],
  MANAGEMENT: [
    P.SHIPMENT.READ, P.SHIPMENT.EXPORT, P.DRIVER.READ, P.VEHICLE.READ, P.CUSTOMER.READ,
    P.DELIVERY.READ, P.WAREHOUSE.READ, P.REPORT.VIEW, P.REPORT.EXPORT, P.NOTIFICATION.READ,
  ],
  CUSTOMER_SERVICE: [
    P.SHIPMENT.READ, P.SHIPMENT.UPDATE,
    P.CUSTOMER.READ, P.CUSTOMER.CREATE, P.CUSTOMER.UPDATE,
    P.DELIVERY.READ, P.DELIVERY.RESCHEDULE, P.NOTIFICATION.READ, P.NOTIFICATION.SEND, P.REPORT.VIEW,
  ],
  DRIVER: [
      P.SHIPMENT.READ, P.SHIPMENT.UPDATE, P.DELIVERY.READ, P.DELIVERY.START, P.DELIVERY.COMPLETE, P.DELIVERY.FAIL,
      P.WAREHOUSE.READ,
    P.GPS.SEND,
    P.DAILY_REPORT.READ, P.DAILY_REPORT.CREATE,
    P.NOTIFICATION.READ,
  ],
  CUSTOMER: [P.SHIPMENT.READ, P.NOTIFICATION.READ],
};

import { prisma } from './prisma';

export async function ensureTenantPermissions(tenantId: string) {
  const allCodes = new Set<string>();
  Object.values(ROLE_PERMS).forEach(perms => perms.forEach(p => allCodes.add(p)));

  const permMap: Record<string, string> = {};
  for (const code of allCodes) {
    const [resource, action] = code.split('.');
    const perm = await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, resource, action, label: `${resource}.${action}` },
    });
    permMap[code] = perm.id;
  }

  const existing = await prisma.rolePermission.findMany({
    where: { tenantId },
    select: { permissionId: true, role: true },
  });
  const existingSet = new Set(existing.map(e => `${e.role}:${e.permissionId}`));

  const toCreate: { permissionId: string; role: string; tenantId: string }[] = [];
  for (const [role, perms] of Object.entries(ROLE_PERMS)) {
    for (const code of perms) {
      const permId = permMap[code];
      if (!permId) continue;
      if (!existingSet.has(`${role}:${permId}`)) {
        toCreate.push({ permissionId: permId, role, tenantId });
      }
    }
  }

  if (toCreate.length > 0) {
     
    await prisma.rolePermission.createMany({ data: toCreate as any, skipDuplicates: true });
  }

  return toCreate.length;
}
