const { PrismaClient, ShipmentStatus, ServiceType, Role, GeofenceType, TenantStatus } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const P = {
  TENANT: { READ: 'tenant.read', CREATE: 'tenant.create', UPDATE: 'tenant.update', DELETE: 'tenant.delete' },
  USER: { READ: 'user.read', CREATE: 'user.create', UPDATE: 'user.update', DELETE: 'user.delete' },
  DRIVER: { READ: 'driver.read', CREATE: 'driver.create', UPDATE: 'driver.update', DELETE: 'driver.delete', ASSIGN: 'driver.assign' },
  VEHICLE: { READ: 'vehicle.read', CREATE: 'vehicle.create', UPDATE: 'vehicle.update', DELETE: 'vehicle.delete' },
  CUSTOMER: { READ: 'customer.read', CREATE: 'customer.create', UPDATE: 'customer.update', DELETE: 'customer.delete' },
  SHIPMENT: { READ: 'shipment.read', CREATE: 'shipment.create', UPDATE: 'shipment.update', CANCEL: 'shipment.cancel', ASSIGN: 'shipment.assign', EXPORT: 'shipment.export' },
  DELIVERY: { READ: 'delivery.read', DISPATCH: 'delivery.dispatch', START: 'delivery.start', COMPLETE: 'delivery.complete', FAIL: 'delivery.fail', RESCHEDULE: 'delivery.reschedule' },
  WAREHOUSE: { READ: 'warehouse.read', SCAN: 'warehouse.scan', SORT: 'warehouse.sort', UPDATE: 'warehouse.update' },
  REPORT: { VIEW: 'report.view', EXPORT: 'report.export' },
  AUDIT: { READ: 'audit.read' },
  GEOFENCE: { READ: 'geofence.read', CREATE: 'geofence.create', UPDATE: 'geofence.update', DELETE: 'geofence.delete' },
  NOTIFICATION: { READ: 'notification.read', SEND: 'notification.send' },
  ORGANIZATION: { READ: 'organization.read', CREATE: 'organization.create', UPDATE: 'organization.update', DELETE: 'organization.delete' },
  REGION: { READ: 'region.read', CREATE: 'region.create', UPDATE: 'region.update', DELETE: 'region.delete' },
  BRANCH: { READ: 'branch.read', CREATE: 'branch.create', UPDATE: 'branch.update', DELETE: 'branch.delete' },
  DEPARTMENT: { READ: 'department.read', CREATE: 'department.create', UPDATE: 'department.update', DELETE: 'department.delete' },
  HUB: { READ: 'hub.read', CREATE: 'hub.create', UPDATE: 'hub.update', DELETE: 'hub.delete' },
  SETTINGS: { READ: 'settings.read', UPDATE: 'settings.update', DELETE: 'settings.delete' },
  SLA: { READ: 'sla.read', CREATE: 'sla.create', UPDATE: 'sla.update', DELETE: 'sla.delete' },
  EXCEPTION: { READ: 'exception.read', CREATE: 'exception.create', UPDATE: 'exception.update', ASSIGN: 'exception.assign' },
  ANALYTICS: { VIEW: 'analytics.view' },
  CONTROL_TOWER: { VIEW: 'control_tower.view' },
  DISPATCH: { VIEW: 'dispatch.view', ASSIGN: 'dispatch.assign' },
  INTEGRATION: { READ: 'integration.read', CREATE: 'integration.create', UPDATE: 'integration.update', DELETE: 'integration.delete' },
  WEBHOOK: { READ: 'webhook.read', CREATE: 'webhook.create', UPDATE: 'webhook.update', DELETE: 'webhook.delete' },
  API_KEY: { READ: 'api_key.read', CREATE: 'api_key.create', DELETE: 'api_key.delete' },
  BILLING: { READ: 'billing.read', MANAGE: 'billing.manage' },
  GPS: { SEND: 'gps.send', READ: 'gps.read' },
  FILE: { READ: 'file.read', UPLOAD: 'file.upload' },
  DAILY_REPORT: { READ: 'daily_report.read', CREATE: 'daily_report.create' },
};
const allPerms = Object.values(P).flatMap((r) => Object.values(r));

const ROLE_PERMS = {
  SUPER_ADMIN: allPerms,
  ADMIN_OPERASIONAL: [
    P.USER.READ, P.USER.CREATE, P.USER.UPDATE,
    P.DRIVER.READ, P.DRIVER.CREATE, P.DRIVER.UPDATE, P.DRIVER.ASSIGN,
    P.VEHICLE.READ, P.VEHICLE.CREATE, P.VEHICLE.UPDATE,
    P.CUSTOMER.READ, P.CUSTOMER.CREATE, P.CUSTOMER.UPDATE,
    P.SHIPMENT.READ, P.SHIPMENT.CREATE, P.SHIPMENT.UPDATE, P.SHIPMENT.CANCEL, P.SHIPMENT.ASSIGN, P.SHIPMENT.EXPORT,
    P.DELIVERY.READ, P.DELIVERY.DISPATCH, P.DELIVERY.START, P.DELIVERY.COMPLETE, P.DELIVERY.FAIL, P.DELIVERY.RESCHEDULE,
    P.WAREHOUSE.READ, P.WAREHOUSE.SCAN, P.WAREHOUSE.SORT,
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
    P.SHIPMENT.READ, P.DELIVERY.READ, P.DELIVERY.START, P.DELIVERY.COMPLETE, P.DELIVERY.FAIL,
    P.WAREHOUSE.READ, P.WAREHOUSE.SCAN,
  ],
  CUSTOMER: [P.SHIPMENT.READ, P.NOTIFICATION.READ],
};

const prisma = new PrismaClient();

const COORDS = {
  jakarta: { lat: -6.2088, lng: 106.8456 },
  'jakarta selatan': { lat: -6.2615, lng: 106.8104 },
  'jakarta barat': { lat: -6.1683, lng: 106.7587 },
  'jakarta timur': { lat: -6.225, lng: 106.9004 },
  'jakarta utara': { lat: -6.1324, lng: 106.8806 },
  bandung: { lat: -6.9175, lng: 107.6191 },
  surabaya: { lat: -7.2575, lng: 112.7521 },
  bekasi: { lat: -6.2383, lng: 106.9756 },
  bogor: { lat: -6.5971, lng: 106.806 },
  tangerang: { lat: -6.1783, lng: 106.6319 },
  'tangerang selatan': { lat: -6.2886, lng: 106.7179 },
  depok: { lat: -6.4025, lng: 106.7942 },
  semarang: { lat: -6.9667, lng: 110.4167 },
};

const coordForCity = (city) => (city ? COORDS[String(city).toLowerCase().trim()] : null) || null;
const SLA_HOURS = { SAME_DAY: 12, NEXT_DAY: 24, REGULAR: 96 };
const slaDeadlineFor = (service, createdAt) =>
  new Date(createdAt.getTime() + (SLA_HOURS[service] || 96) * 3600000);

async function main() {
  console.log('Seeding database DTMS...');

  await prisma.usageRecord.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.integrationLog.deleteMany();
  await prisma.integrationConfig.deleteMany();
  await prisma.webhookSubscription.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.demoRequest.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.proofOfDelivery.deleteMany();
  await prisma.gpsLog.deleteMany();
  await prisma.geofenceEvent.deleteMany();
  await prisma.geofence.deleteMany();
  await prisma.trackingEvent.deleteMany();
  await prisma.deliveryAssignment.deleteMany();
  await prisma.shipmentItem.deleteMany();
  await prisma.warehouseScan.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.hub.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.department.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.company.deleteMany();
  await prisma.tenant.deleteMany();

  // --- Plans ---
  const planData = [
    { name: 'Free', code: 'FREE', description: 'Coba gratis selamanya', priceMonthly: 0, priceYearly: 0, maxUsers: 2, maxDrivers: 5, maxShipments: 50, maxStorageMb: 50, features: ['basic_tracking', 'dispatch'], sortOrder: 0 },
    { name: 'Starter', code: 'STARTER', description: 'Untuk bisnis kecil', priceMonthly: 199000, priceYearly: 1990000, maxUsers: 5, maxDrivers: 15, maxShipments: 500, maxStorageMb: 500, features: ['basic_tracking', 'dispatch', 'reports'], sortOrder: 1 },
    { name: 'Professional', code: 'PRO', description: 'Untuk tim operasional', priceMonthly: 499000, priceYearly: 4990000, maxUsers: 20, maxDrivers: 50, maxShipments: 5000, maxStorageMb: 2000, features: ['basic_tracking', 'dispatch', 'reports', 'sla', 'eta', 'control_tower', 'api', 'webhooks'], sortOrder: 2 },
    { name: 'Enterprise', code: 'ENTERPRISE', description: 'Untuk perusahaan besar', priceMonthly: 1499000, priceYearly: 14990000, maxUsers: -1, maxDrivers: -1, maxShipments: -1, maxStorageMb: -1, features: ['basic_tracking', 'dispatch', 'reports', 'sla', 'eta', 'control_tower', 'api', 'webhooks', 'integrations', 'priority_support'], sortOrder: 3 },
  ];
  for (const p of planData) {
    await prisma.plan.upsert({ where: { code: p.code }, update: p, create: p });
  }
  console.log('Plans seeded');

  const tenant = await prisma.tenant.create({
    data: {
      name: 'DTMS Demo',
      slug: 'default',
      code: 'DTMS',
      status: TenantStatus.ACTIVE,
      primaryColor: '#2563eb',
      secondaryColor: '#1e40af',
      accentColor: '#3b82f6',
      plan: 'ENTERPRISE',
      timezone: 'Asia/Jakarta',
      locale: 'id-ID',
      currency: 'IDR',
      maxUsers: 100,
      maxDrivers: 100,
      maxShipments: 10000,
      contactName: 'Admin DTMS',
      contactEmail: 'admin@dtms.local',
    },
  });

  await prisma.tenant.create({
    data: {
      name: 'PT Logistik Nusantara',
      slug: 'logistik-nusantara',
      code: 'LOGNUS',
      status: TenantStatus.ACTIVE,
      primaryColor: '#059669',
      secondaryColor: '#047857',
      accentColor: '#10b981',
      plan: 'PRO',
      timezone: 'Asia/Jakarta',
      locale: 'id-ID',
      currency: 'IDR',
      maxUsers: 25,
      maxDrivers: 50,
      maxShipments: 1000,
    },
  });

  const hash = (pw) => bcrypt.hashSync(pw, 10);

  const company = await prisma.company.create({
    data: { tenantId: tenant.id, name: 'DTMS Logistics', code: 'LOG', city: 'Jakarta', address: 'Jl. Sudirman No. 1', latitude: -6.2088, longitude: 106.8456 },
  });

  const branch = await prisma.branch.create({
    data: { tenantId: tenant.id, companyId: company.id, name: 'Cabang Jakarta Pusat', code: 'JKT-PUSAT', city: 'Jakarta', address: 'Jl. Thamrin No. 10', latitude: -6.1865, longitude: 106.8346 },
  });

  const branchBandung = await prisma.branch.create({
    data: { tenantId: tenant.id, companyId: company.id, name: 'Cabang Bandung', code: 'BDG', city: 'Bandung', address: 'Jl. Asia Afrika No. 1', latitude: -6.9175, longitude: 107.6191 },
  });

  await prisma.department.create({ data: { tenantId: tenant.id, companyId: company.id, name: 'Operasional', code: 'OPS' } });
  await prisma.department.create({ data: { tenantId: tenant.id, companyId: company.id, name: 'Logistik', code: 'LOG' } });
  await prisma.department.create({ data: { tenantId: tenant.id, companyId: company.id, name: 'Finance', code: 'FIN' } });

  const warehouse = await prisma.warehouse.create({
    data: { tenantId: tenant.id, branchId: branch.id, name: 'Gudang Pusat Jakarta', code: 'GDC-JKT', city: 'Jakarta', latitude: -6.213, longitude: 106.845, radiusMeters: 800 },
  });

  const hub = await prisma.hub.create({
    data: { tenantId: tenant.id, branchId: branchBandung.id, name: 'Hub Bandung', code: 'HUB-BDG', city: 'Bandung', latitude: -6.917, longitude: 107.619, radiusMeters: 800 },
  });

  // --- Permissions ---
  const permissionCodes = new Set();
  Object.values(ROLE_PERMS).forEach((perms) => perms.forEach((p) => permissionCodes.add(p)));
  const permissionRecords = {};
  for (const code of permissionCodes) {
    const [resource, action] = code.split('.');
    const perm = await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, resource, action, label: `${resource}.${action}` },
    });
    permissionRecords[code] = perm;
  }

  for (const [role, perms] of Object.entries(ROLE_PERMS)) {
    for (const permCode of perms) {
      const perm = permissionRecords[permCode];
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { permissionId_role_tenantId: { permissionId: perm.id, role, tenantId: tenant.id } },
        update: {},
        create: { permissionId: perm.id, role, tenantId: tenant.id },
      });
    }
  }

  const superAdmin = await prisma.user.create({
    data: { name: 'Super Admin', username: 'superadmin', passwordHash: hash('admin123'), role: Role.SUPER_ADMIN, email: 'superadmin@dtms.local' },
  });
  await prisma.user.create({
    data: { name: 'Admin Operasional', username: 'admin', passwordHash: hash('admin123'), role: Role.ADMIN_OPERASIONAL, email: 'admin@dtms.local', tenantId: tenant.id },
  });
  await prisma.user.create({
    data: { name: 'Dispatcher', username: 'dispatcher', passwordHash: hash('admin123'), role: Role.DISPATCHER, tenantId: tenant.id },
  });
  await prisma.user.create({
    data: { name: 'Staff Gudang', username: 'warehouse', passwordHash: hash('admin123'), role: Role.WAREHOUSE, tenantId: tenant.id },
  });
  await prisma.user.create({
    data: { name: 'Customer Service', username: 'cs', passwordHash: hash('admin123'), role: Role.CUSTOMER_SERVICE, tenantId: tenant.id },
  });
  await prisma.user.create({
    data: { name: 'Supervisor', username: 'supervisor', passwordHash: hash('admin123'), role: Role.SUPERVISOR, tenantId: tenant.id },
  });
  await prisma.user.create({
    data: { name: 'Manajemen', username: 'management', passwordHash: hash('admin123'), role: Role.MANAGEMENT, tenantId: tenant.id },
  });

  const driverUser1 = await prisma.user.create({
    data: { name: 'Budi Santoso', username: 'driver1', passwordHash: hash('driver123'), role: Role.DRIVER, phone: '081234567801', email: 'driver1@dtms.local', tenantId: tenant.id },
  });
  const driverUser2 = await prisma.user.create({
    data: { name: 'Agus Wijaya', username: 'driver2', passwordHash: hash('driver123'), role: Role.DRIVER, phone: '081234567802', tenantId: tenant.id },
  });

  const customers = await Promise.all([
    prisma.customer.create({ data: { name: 'PT Maju Jaya Abadi', phone: '021-5550101', email: 'ops@majujaya.co.id', address: 'Jl. Sudirman Kav 52', city: 'Jakarta Selatan', postalCode: '12190', tenantId: tenant.id } }),
    prisma.customer.create({ data: { name: 'CV Sinar Logistik', phone: '021-5550102', email: 'halo@sinarlogistik.com', address: 'Jl. Gatot Subroto No. 21', city: 'Jakarta Selatan', postalCode: '12930', tenantId: tenant.id } }),
    prisma.customer.create({ data: { name: 'Toko Elektronik Sentral', phone: '022-5550103', email: 'sentralelektronik@gmail.com', address: 'Jl. Braga No. 12', city: 'Bandung', postalCode: '40111', tenantId: tenant.id } }),
    prisma.customer.create({ data: { name: 'Rumah Sakit Sehat', phone: '031-5550104', email: 'logistik@rssehat.co.id', address: 'Jl. Ahmad Yani No. 88', city: 'Surabaya', postalCode: '60231', tenantId: tenant.id } }),
    prisma.customer.create({ data: { name: 'CV Berkah Fashion', phone: '022-5550105', email: 'berkahfashion@gmail.com', address: 'Jl. Dago No. 45', city: 'Bandung', postalCode: '40135', tenantId: tenant.id } }),
    prisma.customer.create({ data: { name: 'PT Digital Nusantara', phone: '021-5550106', email: 'cs@digitalnusantara.id', address: 'Tbk. Kawasan BSD Sektor 11', city: 'Tangerang Selatan', postalCode: '15311', tenantId: tenant.id } }),
    prisma.customer.create({ data: { name: 'Ibu Siti Rahayu', phone: '085211223344', address: 'Jl. Melati No. 7, Pondok Indah', city: 'Jakarta Selatan', postalCode: '12310', tenantId: tenant.id } }),
    prisma.customer.create({ data: { name: 'Bapak Andi Pratama', phone: '081388771122', address: 'Jl. Merdeka No. 101', city: 'Bandung', postalCode: '40112', tenantId: tenant.id } }),
  ]);

  const driver1 = await prisma.driver.create({
    data: { employeeId: 'DRV-001', name: 'Budi Santoso', phone: '081234567801', userId: driverUser1.id, tenantId: tenant.id },
  });
  const driver2 = await prisma.driver.create({
    data: { employeeId: 'DRV-002', name: 'Agus Wijaya', phone: '081234567802', userId: driverUser2.id, tenantId: tenant.id },
  });

  const v1 = await prisma.vehicle.create({ data: { vehicleNumber: 'B 1234 CD', type: 'Pickup', capacity: 1000, status: 'IN_USE', tenantId: tenant.id } });
  const v2 = await prisma.vehicle.create({ data: { vehicleNumber: 'B 5678 EF', type: 'Truck Box', capacity: 5000, status: 'IN_USE', tenantId: tenant.id } });
  await prisma.vehicle.create({ data: { vehicleNumber: 'B 9012 GH', type: 'Van', capacity: 800, status: 'AVAILABLE', tenantId: tenant.id } });
  await prisma.vehicle.create({ data: { vehicleNumber: 'B 3456 IJ', type: 'Motor', capacity: 150, status: 'MAINTENANCE', tenantId: tenant.id } });

  await prisma.geofence.create({
    data: { name: 'Gudang Pusat Jakarta', latitude: -6.213, longitude: 106.845, radiusMeters: 800, type: GeofenceType.WAREHOUSE, description: 'Perimeter gudang induk, memicu alert saat driver masuk/keluar', tenantId: tenant.id },
  });
  await prisma.geofence.create({
    data: { name: 'Hub Bandung', latitude: -6.917, longitude: 107.619, radiusMeters: 800, type: GeofenceType.HUB, description: 'Perimeter hub Bandung', tenantId: tenant.id },
  });
  await prisma.geofence.create({
    data: { name: 'Cakupan Jakarta', latitude: -6.2088, longitude: 106.8456, radiusMeters: 15000, type: GeofenceType.OPERATIONAL_AREA, description: 'Wilayah operasional utama', tenantId: tenant.id },
  });

  const daysAgo = (n, h = 9, m = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(h, m, 0, 0);
    return d;
  };

  const nextTracking = () => {
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
    return `DTMS-${ymd}-${String(100000 + Math.floor(Math.random() * 899999))}`;
  };

  async function makeShipment({ sender, receiver, weight, service, status, fragile, from, to }) {
    const origin = coordForCity(sender.city) || { lat: -6.213, lng: 106.845 };
    const dest = coordForCity(receiver.city) || to || { lat: -6.2088, lng: 106.8456 };
    const s = await prisma.shipment.create({
      data: {
        trackingNumber: nextTracking(),
        senderId: sender.id,
        receiverId: receiver.id,
        origin: sender.city || sender.address,
        destination: receiver.city || receiver.address,
        originLat: origin.lat,
        originLng: origin.lng,
        destLat: dest.lat,
        destLng: dest.lng,
        weight,
        serviceType: service,
        status,
        fragile,
        slaDeadline: slaDeadlineFor(service, from),
        itemName: 'Paket Campuran',
        itemCount: 1,
        itemCategory: 'Umum',
        itemValue: 500000,
        createdAt: from,
        updatedAt: from,
        tenantId: tenant.id,
        items: {
          create: { itemName: 'Paket Campuran', quantity: 1, weight },
        },
      },
    });

    const events = [];
    const push = (st, at, lat = null, lng = null, notes = null) =>
      events.push({ shipmentId: s.id, status: st, latitude: lat, longitude: lng, notes, createdAt: at });

    push(ShipmentStatus.ORDER_CREATED, from);

    if (status !== ShipmentStatus.ORDER_CREATED) {
      push(ShipmentStatus.WAREHOUSE_RECEIVED, new Date(from.getTime() + 3 * 3600000), -6.213, 106.845, 'Gudang Pusat Jakarta');
    }
    if ([ShipmentStatus.DISPATCHED, ShipmentStatus.IN_TRANSIT, ShipmentStatus.ARRIVED_AT_HUB, ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.DELIVERED, ShipmentStatus.DELIVERY_FAILED, ShipmentStatus.RETURNED, ShipmentStatus.RESCHEDULED].includes(status)) {
      push(ShipmentStatus.DISPATCHED, new Date(from.getTime() + 5 * 3600000), -6.23, 106.86);
    }
    if ([ShipmentStatus.IN_TRANSIT, ShipmentStatus.ARRIVED_AT_HUB, ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.DELIVERED, ShipmentStatus.DELIVERY_FAILED, ShipmentStatus.RETURNED, ShipmentStatus.RESCHEDULED].includes(status)) {
      push(ShipmentStatus.IN_TRANSIT, new Date(from.getTime() + 15 * 3600000), -6.25, 106.87);
    }
    if ([ShipmentStatus.ARRIVED_AT_HUB, ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.DELIVERED, ShipmentStatus.DELIVERY_FAILED, ShipmentStatus.RETURNED, ShipmentStatus.RESCHEDULED].includes(status)) {
      push(ShipmentStatus.ARRIVED_AT_HUB, new Date(from.getTime() + 20 * 3600000), to.lat, to.lng, 'Tiba di hub tujuan');
    }
    if ([ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.DELIVERED, ShipmentStatus.DELIVERY_FAILED, ShipmentStatus.RETURNED, ShipmentStatus.RESCHEDULED].includes(status)) {
      push(ShipmentStatus.OUT_FOR_DELIVERY, new Date(from.getTime() + 23 * 3600000), to.lat, to.lng, 'Kurir menuju lokasi penerima');
    }
    if (status === ShipmentStatus.DELIVERED) {
      push(ShipmentStatus.DELIVERED, new Date(from.getTime() + 26 * 3600000), to.lat, to.lng, 'Barang diterima');
    }
    if (status === ShipmentStatus.DELIVERY_FAILED) {
      push(ShipmentStatus.DELIVERY_FAILED, new Date(from.getTime() + 26 * 3600000), to.lat, to.lng, 'Penerima tidak berada di lokasi');
    }
    if (status === ShipmentStatus.RESCHEDULED) {
      push(ShipmentStatus.DELIVERY_FAILED, new Date(from.getTime() + 26 * 3600000), to.lat, to.lng, 'Alamat tidak ditemukan');
      push(ShipmentStatus.RESCHEDULED, new Date(from.getTime() + 27 * 3600000));
    }
    if (status === ShipmentStatus.RETURNED) {
      push(ShipmentStatus.DELIVERY_FAILED, new Date(from.getTime() + 26 * 3600000), to.lat, to.lng, 'Penerima menolak');
      push(ShipmentStatus.RETURN_TO_SENDER, new Date(from.getTime() + 30 * 3600000), from.lat, from.lng);
      push(ShipmentStatus.RETURNED, new Date(from.getTime() + 34 * 3600000), from.lat, from.lng, 'Barang dikembalikan ke pengirim');
    }

    await prisma.trackingEvent.createMany({ data: events });

    if (status !== ShipmentStatus.ORDER_CREATED && status !== ShipmentStatus.DELIVERY_FAILED && status !== ShipmentStatus.RESCHEDULED) {
      await prisma.deliveryAssignment.create({
        data: {
          shipmentId: s.id,
          driverId: Math.random() > 0.5 ? driver1.id : driver2.id,
          vehicleId: Math.random() > 0.5 ? v1.id : v2.id,
          assignedAt: new Date(from.getTime() + 6 * 3600000),
        },
      });
    }

    if (status === ShipmentStatus.DELIVERED) {
      await prisma.proofOfDelivery.create({
        data: {
          shipmentId: s.id,
          receiverName: receiver.name,
          signature: 'data:image/png;base64,',
          latitude: to.lat,
          longitude: to.lng,
          notes: 'Barang diterima dalam kondisi baik',
          deliveredAt: new Date(from.getTime() + 26 * 3600000),
        },
      });
    }
    return s;
  }

  const now = new Date();
  const today = daysAgo(0, 8, 30);

  await makeShipment({ sender: customers[0], receiver: customers[6], weight: 12.5, service: ServiceType.SAME_DAY, status: ShipmentStatus.OUT_FOR_DELIVERY, from: today, to: { lat: -6.262, lng: 106.783 } });
  await makeShipment({ sender: customers[1], receiver: customers[7], weight: 8.0, service: ServiceType.SAME_DAY, status: ShipmentStatus.IN_TRANSIT, from: today, to: { lat: -6.255, lng: 106.822 } });
  await makeShipment({ sender: customers[2], receiver: customers[4], weight: 45.0, service: ServiceType.REGULAR, status: ShipmentStatus.ARRIVED_AT_HUB, from: daysAgo(1, 10, 15), to: { lat: -6.91, lng: 107.63 } });
  await makeShipment({ sender: customers[5], receiver: customers[1], weight: 3.2, service: ServiceType.NEXT_DAY, status: ShipmentStatus.WAREHOUSE_RECEIVED, from: today, to: { lat: -6.24, lng: 106.83 } });
  await makeShipment({ sender: customers[3], receiver: customers[0], weight: 200.0, service: ServiceType.REGULAR, status: ShipmentStatus.DISPATCHED, from: daysAgo(1, 9, 0), to: { lat: -7.25, lng: 112.75 } });
  await makeShipment({ sender: customers[6], receiver: customers[5], weight: 1.5, service: ServiceType.NEXT_DAY, status: ShipmentStatus.ORDER_CREATED, from: today, to: { lat: -6.30, lng: 106.65 } });
  await makeShipment({ sender: customers[4], receiver: customers[2], weight: 60.0, service: ServiceType.REGULAR, status: ShipmentStatus.DELIVERED, from: daysAgo(2, 8, 0), to: { lat: -6.92, lng: 107.60 } });
  await makeShipment({ sender: customers[2], receiver: customers[7], weight: 18.0, service: ServiceType.NEXT_DAY, status: ShipmentStatus.OUT_FOR_DELIVERY, from: daysAgo(0, 7, 45), to: { lat: -6.91, lng: 107.63 } });
  await makeShipment({ sender: customers[0], receiver: customers[3], weight: 500.0, service: ServiceType.REGULAR, status: ShipmentStatus.IN_TRANSIT, from: daysAgo(1, 14, 20), to: { lat: -7.26, lng: 112.75 } });
  await makeShipment({ sender: customers[7], receiver: customers[0], weight: 5.0, service: ServiceType.SAME_DAY, status: ShipmentStatus.DELIVERY_FAILED, from: today, to: { lat: -6.21, lng: 106.84 } });
  await makeShipment({ sender: customers[1], receiver: customers[5], weight: 22.0, service: ServiceType.NEXT_DAY, status: ShipmentStatus.RESCHEDULED, from: daysAgo(1, 9, 30), to: { lat: -6.30, lng: 106.65 } });
  await makeShipment({ sender: customers[5], receiver: customers[3], weight: 30.0, service: ServiceType.REGULAR, status: ShipmentStatus.RETURNED, from: daysAgo(3, 9, 0), to: { lat: -6.21, lng: 106.86 } });
  await makeShipment({ sender: customers[6], receiver: customers[2], weight: 2.0, service: ServiceType.REGULAR, status: ShipmentStatus.DISPATCHED, from: today, to: { lat: -6.91, lng: 107.60 } });

  const gpsPoints = [
    [-6.2, 106.816, 40, 90],
    [-6.21, 106.83, 32, 120],
    [-6.222, 106.845, 45, 135],
    [-6.234, 106.86, 28, 150],
    [-6.245, 106.872, 50, 160],
    [-6.258, 106.89, 38, 170],
    [-6.27, 106.905, 24, 180],
  ];
  for (let i = 0; i < gpsPoints.length; i++) {
    const t = new Date(now.getTime() - (gpsPoints.length - i) * 2 * 60000);
    await prisma.gpsLog.create({
      data: {
        driverId: driver1.id,
        vehicleId: v1.id,
        latitude: gpsPoints[i][0],
        longitude: gpsPoints[i][1],
        speed: gpsPoints[i][2],
        heading: gpsPoints[i][3],
        accuracy: 8,
        battery: Math.max(55, 95 - i * 5),
        createdAt: t,
      },
    });
    await prisma.gpsLog.create({
      data: {
        driverId: driver2.id,
        vehicleId: v2.id,
        latitude: gpsPoints[i][0] + 0.02,
        longitude: gpsPoints[i][1] - 0.015,
        speed: 35 + i * 3,
        heading: 200 + i * 10,
        accuracy: 9,
        battery: 80 - i * 4,
        createdAt: t,
      },
    });
  }

  await prisma.auditLog.create({
    data: { userId: superAdmin.id, action: 'SEED_DATA', module: 'SYSTEM', newData: 'Database DTMS diisi data contoh', createdAt: now },
  });

  await prisma.$disconnect();
  console.log('Seed selesai. Tenant: default. Akun: superadmin/admin123, admin/admin123, driver1/driver123');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
