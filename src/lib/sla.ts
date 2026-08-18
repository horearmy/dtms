import { prisma } from './prisma';

const SLA_HOURS_DEFAULTS: Record<string, number> = {
  SAME_DAY: 12,
  NEXT_DAY: 24,
  REGULAR: 96,
};

export async function calculateSlaDeadline(
  tenantId: string,
  serviceType: string,
  originCity?: string,
  destCity?: string,
): Promise<Date> {
  const policy = await prisma.slaPolicy.findFirst({
    where: {
      tenantId,
      active: true,
      serviceType: serviceType as 'SAME_DAY' | 'NEXT_DAY' | 'REGULAR',
      ...(originCity ? { originCity } : {}),
      ...(destCity ? { destCity } : {}),
    },
    orderBy: { priority: 'desc' },
  });

  const targetHours = policy?.targetHours || SLA_HOURS_DEFAULTS[serviceType] || 96;
  return new Date(Date.now() + targetHours * 3600000);
}

export async function evaluateSlaStatus(tenantId: string) {
  const activeShipments = await prisma.shipment.findMany({
    where: {
      tenantId,
      status: { in: ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_HUB'] },
      slaDeadline: { not: null },
    },
    select: { id: true, slaDeadline: true, status: true },
  });

  const now = new Date();
  const atRiskThreshold = 2 * 3600000; // 2 hours before deadline

  for (const shipment of activeShipments) {
    if (!shipment.slaDeadline) continue;

    const timeRemaining = shipment.slaDeadline.getTime() - now.getTime();
    let status = 'ON_TRACK';

    if (timeRemaining < 0) {
      status = 'BREACHED';
    } else if (timeRemaining < atRiskThreshold) {
      status = 'AT_RISK';
    }

    const existing = await prisma.slaEvent.findFirst({
      where: { shipmentId: shipment.id, tenantId },
    });

    if (existing) {
      if (existing.status !== status) {
        await prisma.slaEvent.update({
          where: { id: existing.id },
          data: {
            status,
            ...(status === 'BREACHED' ? { breachedAt: now } : {}),
          },
        });
      }
    } else {
      await prisma.slaEvent.create({
        data: {
          tenantId,
          shipmentId: shipment.id,
          status,
          deadline: shipment.slaDeadline,
          ...(status === 'BREACHED' ? { breachedAt: now } : {}),
        },
      });
    }
  }
}

export const SLA_STATUS_LABELS: Record<string, string> = {
  ON_TRACK: 'On Track',
  AT_RISK: 'At Risk',
  BREACHED: 'Breached',
  COMPLETED_ON_TIME: 'Selesai Tepat Waktu',
  COMPLETED_LATE: 'Selesai Terlambat',
};

export const SLA_STATUS_COLORS: Record<string, string> = {
  ON_TRACK: 'bg-emerald-100 text-emerald-700',
  AT_RISK: 'bg-amber-100 text-amber-700',
  BREACHED: 'bg-red-100 text-red-700',
  COMPLETED_ON_TIME: 'bg-green-100 text-green-700',
  COMPLETED_LATE: 'bg-orange-100 text-orange-700',
};
