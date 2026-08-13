import { prisma } from './prisma';

const STALE_GPS_MIN = 30;

export async function scanAlerts() {
  const alerts: { count: number; created: boolean }[] = [];

  const shipments = await prisma.shipment.findMany({
    where: { slaDeadline: { not: null } },
    include: { receiver: true },
  });

  for (const s of shipments) {
    if (['DELIVERED', 'RETURNED'].includes(s.status)) continue;
    const deadline = s.slaDeadline!;
    const remaining = deadline.getTime() - Date.now();
    if (remaining >= 0) continue;

    const existing = await prisma.notification.findFirst({
      where: { message: { startsWith: `SLA Terlambat: ${s.trackingNumber}` } },
    });
    if (existing) continue;

    await prisma.notification.create({
      data: {
        message: `SLA Terlambat: ${s.trackingNumber} — ${s.receiver.name} melewati deadline pada ${deadline.toLocaleString('id-ID')}.`,
        userId: null,
      },
    });
    alerts.push({ count: 1, created: true });
  }

  const staleDrivers = await prisma.driver.findMany({
    where: { status: 'ACTIVE' },
    include: {
      user: true,
      gpsLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  for (const d of staleDrivers) {
    const last = d.gpsLogs[0];
    if (!last) continue;
    const staleMin = (Date.now() - last.createdAt.getTime()) / 60000;
    if (staleMin < STALE_GPS_MIN) continue;

    const existing = await prisma.notification.findFirst({
      where: { message: { startsWith: `GPS Driver Terputus: ${d.name}` } },
    });
    if (existing && existing.createdAt > new Date(Date.now() - 6 * 3600000)) continue;

    await prisma.notification.create({
      data: {
        message: `GPS Driver Terputus: ${d.name} — posisi terakhir ${Math.round(staleMin)} menit lalu (${last.latitude.toFixed(5)}, ${last.longitude.toFixed(5)}).`,
        userId: null,
      },
    });
    alerts.push({ count: 1, created: true });
  }

  return alerts;
}