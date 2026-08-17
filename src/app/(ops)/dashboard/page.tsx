import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getSLA } from '@/lib/eta';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import {
  ACTIVE_STATUSES,
  STATUS_LABELS,
  STATUS_COLORS,
  formatDateTime,
} from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSession();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [totalToday, shipments, deliveredCount, activeCount, failedCount, returnedCount, activeDrivers, activeVehicles, recent, orderEvents, deliveredEvents, geofenceEvents, slaAlerts] = await Promise.all([
    prisma.shipment.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.shipment.findMany({ include: { sender: true, receiver: true, assignments: { include: { driver: true } } } }),
    prisma.shipment.count({ where: { status: 'DELIVERED' } }),
    prisma.shipment.count({ where: { status: { in: ACTIVE_STATUSES as never[] } } }),
    prisma.shipment.count({ where: { status: 'DELIVERY_FAILED' } }),
    prisma.shipment.count({ where: { status: 'RETURNED' } }),
    prisma.driver.count({ where: { status: 'ACTIVE' } }),
    prisma.vehicle.count({ where: { status: { in: ['AVAILABLE', 'IN_USE'] } } }),
    prisma.shipment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { sender: true, receiver: true, assignments: { include: { driver: true } } },
    }),
    prisma.trackingEvent.findMany({
      where: { status: 'ORDER_CREATED' },
      select: { shipmentId: true, createdAt: true },
    }),
    prisma.trackingEvent.findMany({
      where: { status: 'DELIVERED' },
      select: { shipmentId: true, createdAt: true },
    }),
    prisma.geofenceEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { geofence: true, driver: true },
    }),
    prisma.notification.findMany({
      where: { message: { startsWith: 'SLA' } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  // SLA monitoring
  let slaRisk = 0;
  let slaBreached = 0;
  let slaOnTime = 0;
  const atRiskList: { shipment: (typeof shipments)[number]; remainingMs: number }[] = [];
  for (const s of shipments) {
    const info = getSLA(s.status, s.slaDeadline, s.serviceType);
    if (info.type === 'AT_RISK') {
      slaRisk++;
      atRiskList.push({ shipment: s, remainingMs: info.remainingMs });
    } else if (info.type === 'BREACHED') slaBreached++;
    else if (info.type === 'ON_TIME') slaOnTime++;
  }
  atRiskList.sort((a, b) => a.remainingMs - b.remainingMs);
  const slaTracked = slaRisk + slaBreached + slaOnTime;
  const slaHealthyRate = slaTracked > 0 ? Math.round((slaOnTime / slaTracked) * 100) : 0;
  void slaHealthyRate;

  const byStatus: Record<string, number> = {};
  shipments.forEach((s) => (byStatus[s.status] = (byStatus[s.status] || 0) + 1));
  const total = shipments.length;
  const successRate = total > 0 ? Math.round((deliveredCount / total) * 100) : 0;
  const failedRate = total > 0 ? Math.round((failedCount / total) * 100) : 0;

  // rata-rata waktu delivery (jam) dari event ORDER_CREATED -> DELIVERED
  const orderMap = new Map(orderEvents.map((e) => [e.shipmentId, new Date(e.createdAt).getTime()]));
  const durations: number[] = [];
  deliveredEvents.forEach((e) => {
    const start = orderMap.get(e.shipmentId);
    if (start) {
      const hours = (new Date(e.createdAt).getTime() - start) / 3600000;
      if (hours >= 0) durations.push(hours);
    }
  });
  const avgHours =
    durations.length > 0 ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : 0;

  const orderByStatus = Object.entries(byStatus).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(1, ...orderByStatus.map(([, c]) => c));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dashboard Operasional</h1>
        <p className="text-sm text-slate-500">Ringkasan pengiriman · {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Shipment Hari Ini" value={totalToday} sub={`${total} total shipment`} color="bg-white" />
        <StatCard label="Shipment Aktif" value={activeCount} sub="Sedang berjalan" color="bg-white" />
        <StatCard label="Delivered" value={deliveredCount} sub={`${successRate}% sukses`} color="bg-emerald-50" />
        <StatCard label="Rata-rata Waktu" value={avgHours > 0 ? `${avgHours} jam` : '-'} sub="Order → Delivered" color="bg-white" />
        <StatCard label="In Transit" value={byStatus['IN_TRANSIT'] || 0} sub="Dalam perjalanan" color="bg-amber-50" />
        <StatCard label="Out for Delivery" value={byStatus['OUT_FOR_DELIVERY'] || 0} sub="Sedang diantar" color="bg-yellow-50" />
        <StatCard label="Gagal Kirim" value={failedCount} sub={`${failedRate}% dari total`} color="bg-red-50" />
        <StatCard label="Driver / Kendaraan Aktif" value={`${activeDrivers} / ${activeVehicles}`} sub="Status aktif" color="bg-white" />
        <StatCard label="SLA At Risk" value={slaRisk} sub="Deadline mendekat" color="bg-amber-50" />
        <StatCard label="SLA Terlambat" value={slaBreached} sub="Melewati deadline" color="bg-red-50" />
        <StatCard label="SLA On Time" value={slaOnTime} sub="Dalam batas SLA" color="bg-emerald-50" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Shipment Terbaru</h2>
            <Link href="/shipments" className="text-xs font-semibold text-brand-600 hover:underline">Lihat semua</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-3">Resi</th>
                  <th className="pb-2 pr-3">Pengirim → Penerima</th>
                  <th className="pb-2 pr-3">Tujuan</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2">Driver</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 font-mono text-xs text-brand-600">
                      <Link href={`/shipments/${s.id}`} className="hover:underline">{s.trackingNumber}</Link>
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-600">{s.sender.name} → {s.receiver.name}</td>
                    <td className="py-2 pr-3 text-xs text-slate-600">{s.destination}</td>
                    <td className="py-2 pr-3"><StatusBadge status={s.status} /></td>
                    <td className="py-2 text-xs text-slate-600">{s.assignments[0]?.driver.name || '-'}</td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-400">Belum ada shipment</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-slate-900">Shipment by Status</h2>
            <div className="space-y-3">
              {orderByStatus.map(([status, cnt]) => (
                <div key={status}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-slate-600">{STATUS_LABELS[status] || status}</span>
                    <span className="text-slate-400">{cnt}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${STATUS_COLORS[status]?.split(' ')[0] || 'bg-slate-300'}`}
                      style={{ width: `${(cnt / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-slate-900">Delivery Performance</h2>
            <div className="flex items-center gap-4">
              <div className="relative h-24 w-24">
                <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-slate-100" strokeWidth="4" />
                  <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-emerald-500" strokeWidth="4" strokeDasharray={`${successRate}, 100`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-800">{successRate}%</div>
              </div>
              <div className="text-xs text-slate-500">
                <div className="mb-1 flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Delivered {successRate}%</div>
                <div className="mb-1 flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /> Failed {failedRate}%</div>
                <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300" /> Lainnya {100 - successRate - failedRate}%</div>
              </div>
            </div>
          </div>

          <Link href="/map" className="block rounded-xl border border-brand-200 bg-brand-50 p-4 text-center transition hover:bg-brand-100">
            <div className="text-sm font-bold text-brand-700">Buka Live Tracking Map</div>
            <div className="text-xs text-brand-500">Posisi driver & kendaraan</div>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">SLA Monitoring</h2>
            <Link href="/reports" className="text-xs font-semibold text-brand-600 hover:underline">Laporan</Link>
          </div>
          {atRiskList.length === 0 && slaAlerts.length === 0 ? (
            <p className="text-sm text-slate-400">Tidak ada shipment berisiko / terlambat SLA.</p>
          ) : (
            <div className="space-y-2">
              {atRiskList.slice(0, 4).map(({ shipment: s, remainingMs }) => (
                <Link key={s.id} href={`/shipments/${s.id}`} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs hover:bg-amber-100">
                  <span className="font-mono font-semibold text-amber-800">{s.trackingNumber}</span>
                  <span className="text-amber-700">At Risk · {s.destination}</span>
                </Link>
              ))}
              {slaAlerts.map((n) => (
                <div key={n.id} className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs">
                  <span className="font-semibold text-red-800">{n.message}</span>
                  <span className="ml-2 shrink-0 text-red-500">{formatDateTime(n.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Geofence Events</h2>
            <Link href="/geofences" className="text-xs font-semibold text-brand-600 hover:underline">Kelola</Link>
          </div>
          {geofenceEvents.length === 0 ? (
            <p className="text-sm text-slate-400">Belum ada event masuk/keluar area.</p>
          ) : (
            <div className="space-y-2">
              {geofenceEvents.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs">
                  <div>
                    <span className={`font-semibold ${ev.eventType === 'ENTER' ? 'text-emerald-600' : 'text-red-500'}`}>{ev.eventType === 'ENTER' ? 'MASUK' : 'KELUAR'}</span>
                    <span className="text-slate-600"> · {ev.driver.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-slate-700">{ev.geofence.name}</div>
                    <div className="text-slate-400">{formatDateTime(ev.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}