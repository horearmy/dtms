import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { runWithTenant } from '@/lib/api-guard';
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

  const data = await runWithTenant(session?.tenantId ?? null, async () => {
    const tenantFilter = session?.tenantId ? { tenantId: session.tenantId } : {};

    const [totalToday, totalCount, shipments, deliveredCount, activeCount, failedCount, returnedCount, activeDrivers, activeVehicles, recent, orderEvents, deliveredEvents, geofenceEvents, slaAlerts, totalBranches, activeBranches, topBranches] = await Promise.all([
      prisma.shipment.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.shipment.count(),
      prisma.shipment.findMany({
        where: {
          status: { notIn: ['DELIVERED', 'RETURNED', 'DELIVERY_FAILED', 'RETURN_TO_SENDER'] },
          ...(session?.tenantId ? { tenantId: session.tenantId } : {}),
        },
        include: { sender: true, receiver: true, assignments: { include: { driver: true } } },
        take: 500,
      }),
      prisma.shipment.count({ where: { status: 'DELIVERED', ...(session?.tenantId ? { tenantId: session.tenantId } : {}) } }),
      prisma.shipment.count({ where: { status: { in: ACTIVE_STATUSES as never[] }, ...(session?.tenantId ? { tenantId: session.tenantId } : {}) } }),
      prisma.shipment.count({ where: { status: 'DELIVERY_FAILED', ...(session?.tenantId ? { tenantId: session.tenantId } : {}) } }),
      prisma.shipment.count({ where: { status: 'RETURNED', ...(session?.tenantId ? { tenantId: session.tenantId } : {}) } }),
      prisma.driver.count({ where: { status: 'ACTIVE', ...(session?.tenantId ? { tenantId: session.tenantId } : {}) } }),
      prisma.vehicle.count({ where: { status: { in: ['AVAILABLE', 'IN_USE'] }, ...(session?.tenantId ? { tenantId: session.tenantId } : {}) } }),
      prisma.shipment.findMany({
        where: session?.tenantId ? { tenantId: session.tenantId } : {},
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { sender: true, receiver: true, assignments: { include: { driver: true } } },
      }),
      prisma.trackingEvent.findMany({
        where: {
          status: 'ORDER_CREATED',
          ...(session?.tenantId ? { shipment: { tenantId: session.tenantId } } : {}),
        },
        select: { shipmentId: true, createdAt: true },
        take: 200,
      }),
      prisma.trackingEvent.findMany({
        where: {
          status: 'DELIVERED',
          ...(session?.tenantId ? { shipment: { tenantId: session.tenantId } } : {}),
        },
        select: { shipmentId: true, createdAt: true },
        take: 200,
      }),
      prisma.geofenceEvent.findMany({
        where: session?.tenantId ? { geofence: { tenantId: session.tenantId } } : {},
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: { geofence: true, driver: true },
      }),
      prisma.notification.findMany({
        where: {
          message: { startsWith: 'SLA' },
          ...(session?.tenantId ? { OR: [
            { shipment: { tenantId: session.tenantId } },
            { userId: { not: null } },
          ] } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.branch.count({ where: session?.tenantId ? { tenantId: session.tenantId } : {} }),
      prisma.branch.count({ where: { active: true, ...(session?.tenantId ? { tenantId: session.tenantId } : {}) } }),
      prisma.branch.findMany({
        where: session?.tenantId ? { tenantId: session.tenantId } : {},
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { name: true } },
          region: { select: { name: true } },
          _count: { select: { users: true, warehouses: true, hubs: true } },
        },
      }),
    ]);

    return { totalToday, totalCount, shipments, deliveredCount, activeCount, failedCount, returnedCount, activeDrivers, activeVehicles, recent, orderEvents, deliveredEvents, geofenceEvents, slaAlerts, totalBranches, activeBranches, topBranches };
  });

  const { totalToday, totalCount, shipments, deliveredCount, activeCount, failedCount, returnedCount, activeDrivers, activeVehicles, recent, orderEvents, deliveredEvents, geofenceEvents, slaAlerts, totalBranches, activeBranches, topBranches } = data;

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
  const total = totalCount;
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
        <h1 className="text-xl font-bold text-[#101828]">Dashboard Operasional</h1>
        <p className="text-sm text-[#667085]">Ringkasan pengiriman Â· {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Shipment Hari Ini" value={totalToday} sub={`${total} total shipment`} color="bg-white" />
        <StatCard label="Shipment Aktif" value={activeCount} sub="Sedang berjalan" color="bg-white" />
        <StatCard label="Delivered" value={deliveredCount} sub={`${successRate}% sukses`} color="bg-emerald-50" />
        <StatCard label="Rata-rata Waktu" value={avgHours > 0 ? `${avgHours} jam` : '-'} sub="Order â†’ Delivered" color="bg-white" />
        <StatCard label="In Transit" value={byStatus['IN_TRANSIT'] || 0} sub="Dalam perjalanan" color="bg-amber-50" />
        <StatCard label="Out for Delivery" value={byStatus['OUT_FOR_DELIVERY'] || 0} sub="Sedang diantar" color="bg-yellow-50" />
        <StatCard label="Gagal Kirim" value={failedCount} sub={`${failedRate}% dari total`} color="bg-red-50" />
        <StatCard label="Driver / Kendaraan Aktif" value={`${activeDrivers} / ${activeVehicles}`} sub="Status aktif" color="bg-white" />
        <StatCard label="SLA At Risk" value={slaRisk} sub="Deadline mendekat" color="bg-amber-50" />
        <StatCard label="SLA Terlambat" value={slaBreached} sub="Melewati deadline" color="bg-red-50" />
        <StatCard label="SLA On Time" value={slaOnTime} sub="Dalam batas SLA" color="bg-emerald-50" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#101828]">Shipment Terbaru</h2>
            <Link href="/shipments" className="text-xs font-semibold text-[#0D6EFD] hover:underline">Lihat semua</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[#F7F9FC] text-left text-xs uppercase tracking-wide text-[#667085]">
                  <th className="pb-2 pr-3">Resi</th>
                  <th className="pb-2 pr-3">Pengirim â†’ Penerima</th>
                  <th className="pb-2 pr-3">Tujuan</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2">Driver</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id} className="border-b border-[#E4E7EC] last:border-0">
                    <td className="py-2 pr-3 font-mono text-xs text-[#0D6EFD]">
                      <Link href={`/shipments/${s.id}`} className="hover:underline">{s.trackingNumber}</Link>
                    </td>
                    <td className="py-2 pr-3 text-xs text-[#667085]">{s.sender.name} {'→'} {s.receiver.name}</td>
                    <td className="py-2 pr-3 text-xs text-[#667085]">{s.destination}</td>
                    <td className="py-2 pr-3"><StatusBadge status={s.status} /></td>
                    <td className="py-2 text-xs text-[#667085]">{s.assignments[0]?.driver.name || '-'}</td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-[#667085]">Belum ada shipment</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h2 className="mb-4 text-sm font-bold text-[#101828]">Shipment by Status</h2>
            <div className="space-y-3">
              {orderByStatus.map(([status, cnt]) => (
                <div key={status}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-[#667085]">{STATUS_LABELS[status] || status}</span>
                    <span className="text-[#667085]">{cnt}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${STATUS_COLORS[status]?.split(' ')[0] || 'bg-gray-300'}`}
                      style={{ width: `${(cnt / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h2 className="mb-3 text-sm font-bold text-[#101828]">Delivery Performance</h2>
            <div className="flex items-center gap-4">
              <div className="relative h-24 w-24">
                <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-gray-100" strokeWidth="4" />
                  <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-[#16B364]" strokeWidth="4" strokeDasharray={`${successRate}, 100`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[#101828]">{successRate}%</div>
              </div>
              <div className="text-xs text-[#667085]">
                <div className="mb-1 flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#16B364]" /> Delivered {successRate}%</div>
                <div className="mb-1 flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#F5222D]" /> Failed {failedRate}%</div>
                <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-300" /> Lainnya {100 - successRate - failedRate}%</div>
              </div>
            </div>
          </div>

          <Link href="/map" className="block rounded-xl border border-[#E4E7EC] bg-white p-4 text-center transition hover:bg-[#F7F9FC]">
            <div className="text-sm font-bold text-[#0D6EFD]">Buka Live Tracking Map</div>
            <div className="text-xs text-[#667085]">Posisi driver & kendaraan</div>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#101828]">SLA Monitoring</h2>
            <Link href="/reports" className="text-xs font-semibold text-[#0D6EFD] hover:underline">Laporan</Link>
          </div>
          {atRiskList.length === 0 && slaAlerts.length === 0 ? (
            <p className="text-sm text-[#667085]">Tidak ada shipment berisiko / terlambat SLA.</p>
          ) : (
            <div className="space-y-2">
              {atRiskList.slice(0, 4).map(({ shipment: s, remainingMs }) => (
                <Link key={s.id} href={`/shipments/${s.id}`} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs hover:bg-amber-100">
                  <span className="font-mono font-semibold text-amber-800">{s.trackingNumber}</span>
                  <span className="text-amber-700">At Risk Â· {s.destination}</span>
                </Link>
              ))}
              {slaAlerts.map((n) => (
                <div key={n.id} className="flex items-center justify-between rounded-lg border border-[#F5222D]/20 bg-[#F5222D]/5 px-3 py-2 text-xs">
                  <span className="font-semibold text-[#F5222D]">{n.message}</span>
                  <span className="ml-2 shrink-0 text-[#F5222D]">{formatDateTime(n.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#101828]">Geofence Events</h2>
            <Link href="/geofences" className="text-xs font-semibold text-[#0D6EFD] hover:underline">Kelola</Link>
          </div>
          {geofenceEvents.length === 0 ? (
            <p className="text-sm text-[#667085]">Belum ada event masuk/keluar area.</p>
          ) : (
            <div className="space-y-2">
              {geofenceEvents.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs">
                  <div>
                    <span className={`font-semibold ${ev.eventType === 'ENTER' ? 'text-[#16B364]' : 'text-[#F5222D]'}`}>{ev.eventType === 'ENTER' ? 'MASUK' : 'KELUAR'}</span>
                    <span className="text-[#667085]"> Â· {ev.driver?.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-[#101828]">{ev.geofence.name}</div>
                    <div className="text-[#667085]">{formatDateTime(ev.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Branch Overview */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#101828]">Branch Overview</h2>
            <Link href="/branches" className="text-xs font-semibold text-[#0D6EFD] hover:underline">Kelola</Link>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#667085]">Total Branch</span>
              <span className="text-lg font-bold text-[#101828]">{totalBranches}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#667085]">Aktif</span>
              <span className="text-lg font-bold text-emerald-600">{activeBranches}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#667085]">Nonaktif</span>
              <span className="text-lg font-bold text-gray-400">{totalBranches - activeBranches}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#101828]">Branch Terbaru</h2>
            <Link href="/branches" className="text-xs font-semibold text-[#0D6EFD] hover:underline">Lihat semua</Link>
          </div>
          {topBranches.length === 0 ? (
            <p className="text-sm text-[#667085]">Belum ada branch.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-[#F7F9FC] text-left text-xs uppercase tracking-wide text-[#667085]">
                    <th className="pb-2 pr-3">Nama</th>
                    <th className="pb-2 pr-3">Organization</th>
                    <th className="pb-2 pr-3">Region</th>
                    <th className="pb-2 pr-3">Users</th>
                    <th className="pb-2 pr-3">Warehouses</th>
                    <th className="pb-2">Hubs</th>
                  </tr>
                </thead>
                <tbody>
                  {topBranches.map((b) => (
                    <tr key={b.id} className="border-b border-[#E4E7EC] last:border-0">
                      <td className="py-2 pr-3 font-medium text-[#101828]">{b.name}</td>
                      <td className="py-2 pr-3 text-xs text-[#667085]">{b.organization?.name || '-'}</td>
                      <td className="py-2 pr-3 text-xs text-[#667085]">{b.region?.name || '-'}</td>
                      <td className="py-2 pr-3 text-xs">{b._count.users}</td>
                      <td className="py-2 pr-3 text-xs">{b._count.warehouses}</td>
                      <td className="py-2 text-xs">{b._count.hubs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
