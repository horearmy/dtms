import { prisma } from './prisma';

export async function driverScore(driverId: string) {
  const assignments = await prisma.deliveryAssignment.findMany({
    where: { driverId },
    include: { shipment: { include: { pods: true } } },
  });

  const total = assignments.length;
  let delivered = 0;
  let onTime = 0;
  let failed = 0;

  for (const a of assignments) {
    const s = a.shipment;
    if (s.status === 'DELIVERED') {
      delivered++;
      const pod = s.pods[0];
      const done = pod?.deliveredAt ? pod.deliveredAt.getTime() : s.updatedAt.getTime();
      if (s.slaDeadline && done <= s.slaDeadline.getTime()) onTime++;
    }
    if (['DELIVERY_FAILED', 'RETURNED'].includes(s.status)) failed++;
  }

  const completionRate = total ? delivered / total : 0;
  const onTimeRate = delivered ? onTime / delivered : 0;
  const failFactor = failed === 0 ? 1 : 0.65;

  const score = total ? Math.round(100 * (0.5 * completionRate + 0.3 * onTimeRate) * failFactor) : 0;

  return { score, total, delivered, onTime, failed };
}

export async function addScoresToDrivers(drivers: Awaited<ReturnType<typeof prisma.driver.findMany>>) {
  const scored = [];
  for (const d of drivers) {
    const stat = await driverScore(d.id);
    scored.push({ ...d, stat });
  }
  return scored;
}