import { prisma } from './prisma';
import { isWhatsAppEnabled, sendSLABreachAlert, sendGPSDisconnectAlert } from './whatsapp';

const STALE_GPS_MIN = 30;

export async function scanAlerts() {
  let created = 0;

  const shipments = await prisma.shipment.findMany({
    where: { slaDeadline: { not: null } },
    include: { receiver: true },
  });

  const overdueShipments = shipments.filter((s) =>
    !['DELIVERED', 'RETURNED'].includes(s.status) &&
    s.slaDeadline !== null &&
    s.slaDeadline.getTime() < Date.now()
  );
  const existingSla = overdueShipments.length === 0
    ? []
    : await prisma.notification.findMany({
      where: {
        OR: overdueShipments.map((s) => ({ message: { startsWith: `SLA Terlambat: ${s.trackingNumber}` } })),
      },
      select: { message: true },
    });

  for (const s of overdueShipments) {
    const deadline = s.slaDeadline!;

    if (existingSla.some((n) => n.message.startsWith(`SLA Terlambat: ${s.trackingNumber}`))) continue;

    await prisma.notification.create({
      data: {
        message: `SLA Terlambat: ${s.trackingNumber} — ${s.receiver.name} melewati deadline pada ${deadline.toLocaleString('id-ID')}.`,
        userId: null,
        tenantId: s.tenantId,
      },
    });

    if (isWhatsAppEnabled()) {
      try {
        await sendSLABreachAlert(s.trackingNumber, s.receiver.name, deadline);
      } catch {
        // non-critical
      }
    }

    created++;
  }

  const staleDrivers = await prisma.driver.findMany({
    where: { status: 'ACTIVE' },
    include: {
      user: true,
      gpsLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  const staleDriverCandidates = staleDrivers.filter((d) => {
    const last = d.gpsLogs[0];
    return last !== undefined && (Date.now() - last.createdAt.getTime()) / 60000 >= STALE_GPS_MIN;
  });
  const existingGps = staleDriverCandidates.length === 0
    ? []
    : await prisma.notification.findMany({
      where: {
        OR: staleDriverCandidates.map((d) => ({ message: { startsWith: `GPS Driver Terputus: ${d.name}` } })),
      },
      orderBy: { createdAt: 'desc' },
      select: { message: true, createdAt: true },
    });
  const latestGps = new Map<string, Date>();
  for (const notification of existingGps) {
    const key = notification.message.match(/^GPS Driver Terputus: (.+?)(?: —|$)/)?.[1];
    if (key && !latestGps.has(key)) latestGps.set(key, notification.createdAt);
  }

  for (const d of staleDriverCandidates) {
    const last = d.gpsLogs[0];
    if (!last) continue;
    const staleMin = (Date.now() - last.createdAt.getTime()) / 60000;
    const existingAt = latestGps.get(d.name);
    if (existingAt && existingAt > new Date(Date.now() - 6 * 3600000)) continue;

    await prisma.notification.create({
      data: {
        message: `GPS Driver Terputus: ${d.name} — posisi terakhir ${Math.round(staleMin)} menit lalu (${last.latitude.toFixed(5)}, ${last.longitude.toFixed(5)}).`,
        userId: null,
        tenantId: d.tenantId,
      },
    });

    if (isWhatsAppEnabled()) {
      try {
        await sendGPSDisconnectAlert(d.name, Math.round(staleMin), last.latitude, last.longitude);
      } catch {
        // non-critical
      }
    }

    created++;
  }

  return created;
}
