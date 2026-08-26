import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { runWithTenant } from '@/lib/api-guard';
import { driverScore } from '@/lib/scoring';
import CsvExport from '@/components/CsvExport';
import { type ReportData } from '@/components/ReportPdfExport';
import ReportPdfExport from '@/components/ReportPdfExportLazy';
import StatusBadge from '@/components/StatusBadge';
import { STATUS_LABELS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const session = await getSession();

  const data = await runWithTenant(session?.tenantId ?? null, async () => {
    const tenantFilter = session?.tenantId ? { tenantId: session.tenantId } : {};
    const [statusGroups, deliveries, returned, failed, drivers, totalCount, orderEvents, deliveredEvents, lastShipments, trendShipments] = await Promise.all([
      prisma.shipment.groupBy({ by: ['status'], _count: { id: true }, where: tenantFilter }),
      prisma.shipment.count({ where: { status: 'DELIVERED', ...tenantFilter } }),
      prisma.shipment.count({ where: { status: 'RETURNED', ...tenantFilter } }),
      prisma.shipment.count({ where: { status: 'DELIVERY_FAILED', ...tenantFilter } }),
      prisma.driver.findMany({ where: tenantFilter, include: { _count: { select: { assignments: true } } } }),
      prisma.shipment.count({ where: tenantFilter }),
      prisma.trackingEvent.findMany({
        where: {
          status: 'ORDER_CREATED',
          ...(session?.tenantId ? { shipment: { tenantId: session.tenantId } } : {}),
        },
        select: { shipmentId: true, createdAt: true },
      }),
      prisma.trackingEvent.findMany({
        where: {
          status: 'DELIVERED',
          ...(session?.tenantId ? { shipment: { tenantId: session.tenantId } } : {}),
        },
        select: { shipmentId: true, createdAt: true },
      }),
      prisma.shipment.findMany({ where: tenantFilter, orderBy: { createdAt: 'desc' }, take: 50, include: { sender: true, receiver: true, assignments: { include: { driver: true } } } }),
      prisma.shipment.findMany({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) }, ...tenantFilter }, select: { destination: true, createdAt: true } }),
    ]);

    return { statusGroups, deliveries, returned, failed, drivers, totalCount, orderEvents, deliveredEvents, lastShipments, trendShipments };
  });

  const { statusGroups, deliveries, returned, failed, drivers, totalCount, orderEvents, deliveredEvents, lastShipments, trendShipments } = data;

  const trend: { date: string; count: number }[] = [];
  const dayMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    dayMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const s of trendShipments) {
    const key = s.createdAt.toISOString().slice(0, 10);
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) || 0) + 1);
  }
  for (const [date, count] of dayMap) trend.push({ date: date.slice(5), count });
  const trendMax = Math.max(1, ...trend.map((t) => t.count));

  const destCount = new Map<string, number>();
  for (const s of trendShipments) destCount.set(s.destination || '-', (destCount.get(s.destination || '-') || 0) + 1);
  const topDestinations = [...destCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const driverStats = await Promise.all(drivers.map((d) => driverScore(d.id)));
  const scoredDrivers = drivers.map((d, i) => ({ ...d, stat: driverStats[i] }));

  const map: Record<string, number> = {};
  statusGroups.forEach((g) => (map[g.status] = g._count.id));
  const successRate = totalCount ? Math.round((deliveries / totalCount) * 100) : 0;
  const failedRate = totalCount ? Math.round((failed / totalCount) * 100) : 0;

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

  const csv = [
    ['No.Resi', 'Pengirim', 'Penerima', 'Tujuan', 'Status', 'Dibuat', 'Driver'],
    ...lastShipments.map((s) => [
      s.trackingNumber,
      s.sender.name,
      s.receiver.name,
      s.destination,
      STATUS_LABELS[s.status] || s.status,
      new Date(s.createdAt).toLocaleString('id-ID'),
      s.assignments[0]?.driver.name || '',
    ]),
  ]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
    .join('\n');

  const reportData: ReportData = {
    totalCount,
    deliveries,
    returned,
    failed,
    successRate,
    failedRate,
    avgHours,
    statusMap: map,
    drivers: scoredDrivers.map((d) => ({
      name: d.name,
      employeeId: d.employeeId,
      score: d.stat.score,
      delivered: d.stat.delivered,
      failed: d.stat.failed,
      onTime: d.stat.onTime,
    })),
    trend,
    topDestinations,
    shipments: lastShipments.map((s) => ({
      trackingNumber: s.trackingNumber,
      sender: s.sender.name,
      receiver: s.receiver.name,
      destination: s.destination || '-',
      status: s.status,
      driver: s.assignments[0]?.driver.name || '',
      createdAt: new Date(s.createdAt).toLocaleString('id-ID'),
    })),
    tenantName: session?.tenantId ? 'Tenant' : 'Semua Tenant',
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#101828]">Reports</h1>
          <p className="text-sm text-[#667085]">Laporan operasional pengiriman</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CsvExport data={csv} filename={`dtms-shipment-report-${new Date().toISOString().slice(0, 10)}.csv`} />
          <ReportPdfExport data={reportData} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric label="Total Shipment" value={totalCount} />
        <Metric label="Delivered" value={deliveries} sub={`${successRate}% sukses`} />
        <Metric label="Gagal Kirim" value={failed} sub={`${failedRate}% dari total`} />
        <Metric label="Rata-rata Waktu" value={avgHours > 0 ? `${avgHours} jam` : '-'} sub="Order â†’ Delivered" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="mb-4 text-sm font-bold text-[#101828]">Shipment Report</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F9FC] text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                  <th className="py-2 pr-3 text-left">Status</th>
                  <th className="py-2 pr-3 text-left">Jumlah</th>
                  <th className="py-2 text-left">Persentase</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(map).map(([st, cnt]) => (
                  <tr key={st} className="border-b border-[#E4E7EC] last:border-0">
                    <td className="py-2 pr-3"><StatusBadge status={st} /></td>
                    <td className="py-2 pr-3 text-[#101828]">{cnt}</td>
                    <td className="py-2 text-[#667085]">{totalCount ? Math.round((cnt / totalCount) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="mb-4 text-sm font-bold text-[#101828]">Driver Scoring</h2>
          <div className="space-y-3">
            {scoredDrivers.map((d) => {
              const scoreColor = d.stat.score >= 80 ? 'bg-emerald-100 text-emerald-700' : d.stat.score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
              return (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-[#E4E7EC] p-3">
                  <div>
                    <div className="text-sm font-semibold text-[#101828]">{d.name}</div>
                    <div className="text-xs text-[#667085]">{d.employeeId} Â· {d.stat.delivered} terkirim Â· {d.stat.failed} gagal Â· {d.stat.onTime} on-time</div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-sm font-bold ${scoreColor}`}>
                    {d.stat.score}
                  </span>
                </div>
              );
            })}
            {drivers.length === 0 && <p className="text-sm text-[#667085]">Belum ada driver</p>}
          </div>
          <p className="mt-3 text-[11px] text-[#667085]">Skor = 50% tingkat penyelesaian + 30% on-time âˆ’ faktor gagal</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="mb-4 text-sm font-bold text-[#101828]">Shipment Trend Â· 7 Hari</h2>
          <div className="flex h-40 items-end gap-2">
            {trend.map((t) => (
              <div key={t.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="relative w-full rounded-t-md bg-[#0D6EFD]" style={{ height: `${Math.max(4, (t.count / trendMax) * 100)}%` }} title={`${t.count}`}>
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-[#667085]">{t.count}</span>
                </div>
                <span className="text-[10px] text-[#667085]">{t.date}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="mb-4 text-sm font-bold text-[#101828]">Top Destinasi Â· 7 Hari</h2>
          <div className="space-y-2">
            {topDestinations.map(([name, count], i) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="text-[#101828]">{i + 1}. {name}</span>
                <span className="text-xs font-semibold text-[#667085]">{count} shipment</span>
              </div>
            ))}
            {topDestinations.length === 0 && <p className="text-sm text-[#667085]">Belum ada data</p>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="border-b border-[#E4E7EC] p-5 pb-3">
          <h2 className="text-sm font-bold text-[#101828]">Detail Shipment Terbaru</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F7F9FC] text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                <th className="px-4 py-3 text-left">Resi</th>
                <th className="px-4 py-3 text-left">Pengirim</th>
                <th className="px-4 py-3 text-left">Penerima</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Driver</th>
                <th className="px-4 py-3 text-left">Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {lastShipments.map((s) => (
                <tr key={s.id} className="border-b border-[#E4E7EC] last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs text-[#0D6EFD]">{s.trackingNumber}</td>
                  <td className="px-4 py-2.5 text-[#101828]">{s.sender.name}</td>
                  <td className="px-4 py-2.5 text-[#101828]">{s.receiver.name}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-2.5 text-[#667085]">{s.assignments[0]?.driver.name || '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-[#667085]">{new Date(s.createdAt).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="text-xs font-semibold uppercase tracking-wide text-[#667085]">{label}</div>
      <div className="mt-1 text-2xl font-bold text-[#101828]">{value}</div>
      {sub && <div className="text-xs text-[#667085]">{sub}</div>}
    </div>
  );
}
