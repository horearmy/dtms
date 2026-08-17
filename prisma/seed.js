const { PrismaClient, ShipmentStatus, ServiceType, Role, GeofenceType } = require('@prisma/client');
const bcrypt = require('bcryptjs');

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
  await prisma.tenant.deleteMany();

  const tenant = await prisma.tenant.create({
    data: {
      name: 'DTMS Demo',
      slug: 'default',
      primaryColor: '#2563eb',
      secondaryColor: '#1e40af',
      accentColor: '#3b82f6',
      plan: 'ENTERPRISE',
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
      primaryColor: '#059669',
      secondaryColor: '#047857',
      accentColor: '#10b981',
      plan: 'BUSINESS',
      maxUsers: 25,
      maxDrivers: 50,
      maxShipments: 1000,
    },
  });

  const hash = (pw) => bcrypt.hashSync(pw, 10);

  const superAdmin = await prisma.user.create({
    data: { name: 'Super Admin', username: 'superadmin', passwordHash: hash('admin123'), role: Role.SUPER_ADMIN, email: 'superadmin@dtms.local', tenantId: tenant.id },
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
