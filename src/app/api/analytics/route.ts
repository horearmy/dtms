import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, runWithTenant } from '@/lib/api-guard';

export async function GET() {
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'SUPERVISOR', 'MANAGEMENT');
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const since = new Date(Date.now() - 7 * 86400000);
    const shipments = await prisma.shipment.findMany({
      where: { createdAt: { gte: since } },
      include: {
        assignments: { include: { driver: true, vehicle: true } },
        events: { orderBy: { createdAt: 'desc' }, take: 1 },
        pods: true,
      },
    });

    const byDay: { date: string; count: number }[] = [];
    const dayMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, 0);
    }
    for (const s of shipments) {
      const key = s.createdAt.toISOString().slice(0, 10);
      if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) || 0) + 1);
    }
    for (const [date, count] of dayMap) byDay.push({ date: date.slice(5), count });

    const destCount = new Map<string, number>();
    for (const s of shipments) {
      const d = s.destination || '-';
      destCount.set(d, (destCount.get(d) || 0) + 1);
    }
    const topDestinations = [...destCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const delivered = shipments.filter((s) => s.status === 'DELIVERED');
    let totalHours = 0;
    let onTime = 0;
    for (const s of delivered) {
      const pod = s.pods[0];
      const created = s.createdAt.getTime();
      const done = pod?.deliveredAt ? pod.deliveredAt.getTime() : s.updatedAt.getTime();
      totalHours += (done - created) / 3600000;
      if (s.slaDeadline && done <= s.slaDeadline.getTime()) onTime++;
    }
    const avgHours = delivered.length ? totalHours / delivered.length : 0;
    const onTimeRate = delivered.length ? Math.round((onTime / delivered.length) * 100) : 0;

    const telemetry = await prisma.vehicle.findMany({
      where: { status: 'IN_USE' },
      include: { gpsLogs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    const vehicleTelemetry = telemetry.map((v) => ({
      vehicleNumber: v.vehicleNumber,
      type: v.type,
      last: v.gpsLogs[0] || null,
    }));

    return NextResponse.json({ byDay, topDestinations, avgHours, onTimeRate, total: shipments.length, delivered: delivered.length, vehicleTelemetry });
  });
}