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
    SCAN: 'warehouse.scan',
    SORT: 'warehouse.sort',
    UPDATE: 'warehouse.update',
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
