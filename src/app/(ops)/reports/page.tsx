import { prisma } from '@/lib/prisma';
import { driverScore } from '@/lib/scoring';
import CsvExport from '@/components/CsvExport';
import StatusBadge from '@/components/StatusBadge';
import { STATUS_LABELS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const [shipments, deliveries, returned, failed, drivers, totalCount, orderEvents, deliveredEvents, lastShipments, trendShipments] = await Promise.all([
    prisma.shipment.findMany({ select: { status: true } }),
    prisma.shipment.count({ where: { status: 'DELIVERED' } }),
    prisma.shipment.count({ where: { status: 'RETURNED' } }),
    prisma.shipment.count({ where: { status: 'DELIVERY_FAILED' } }),
    prisma.driver.findMany({ include: { _count: { select: { assignments: true } } } }),
    prisma.shipment.count(),
    prisma.trackingEvent.findMany({
      where: { status: 'ORDER_CREATED' },
      select: { shipmentId: true, createdAt: true },
    }),
    prisma.trackingEvent.findMany({
      where: { status: 'DELIVERED' },
      select: { shipmentId: true, createdAt: true },
    }),
    prisma.shipment.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { sender: true, receiver: true, assignments: { include: { driver: true } } } }),
    prisma.shipment.findMany({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } }, select: { destination: true, createdAt: true } }),
  ]);

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

  const scoredDrivers = [];
  for (const d of drivers) scoredDrivers.push({ ...d, stat: await driverScore(d.id) });

  const map: Record<string, number> = {};
  shipments.forEach((s) => (map[s.status] = (map[s.status] || 0) + 1));
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">Laporan operasional pengiriman</p>
        </div>
        <CsvExport data={csv} filename={`dtms-shipment-report-${new Date().toISOString().slice(0, 10)}.csv`} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric label="Total Shipment" value={totalCount} />
        <Metric label="Delivered" value={deliveries} sub={`${successRate}% sukses`} />
        <Metric label="Gagal Kirim" value={failed} sub={`${failedRate}% dari total`} />
        <Metric label="Rata-rata Waktu" value={avgHours > 0 ? `${avgHours} jam` : '-'} sub="Order → Delivered" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-slate-900">Shipment Report</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-slate-400">
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Jumlah</th>
                  <th className="py-2">Persentase</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(map).map(([st, cnt]) => (
                  <tr key={st} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3"><StatusBadge status={st} /></td>
                    <td className="py-2 pr-3 text-slate-700">{cnt}</td>
                    <td className="py-2 text-slate-500">{totalCount ? Math.round((cnt / totalCount) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-slate-900">Driver Scoring</h2>
          <div className="space-y-3">
            {scoredDrivers.map((d) => {
              const scoreColor = d.stat.score >= 80 ? 'bg-emerald-100 text-emerald-700' : d.stat.score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
              return (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{d.name}</div>
                    <div className="text-xs text-slate-500">{d.employeeId} · {d.stat.delivered} terkirim · {d.stat.failed} gagal · {d.stat.onTime} on-time</div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-sm font-bold ${scoreColor}`}>
                    {d.stat.score}
                  </span>
                </div>
              );
            })}
            {drivers.length === 0 && <p className="text-sm text-slate-400">Belum ada driver</p>}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">Skor = 50% tingkat penyelesaian + 30% on-time − faktor gagal</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-slate-900">Shipment Trend · 7 Hari</h2>
          <div className="flex h-40 items-end gap-2">
            {trend.map((t) => (
              <div key={t.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="relative w-full rounded-t-md bg-brand-500" style={{ height: `${Math.max(4, (t.count / trendMax) * 100)}%` }} title={`${t.count}`}>
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-600">{t.count}</span>
                </div>
                <span className="text-[10px] text-slate-400">{t.date}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-slate-900">Top Destinasi · 7 Hari</h2>
          <div className="space-y-2">
            {topDestinations.map(([name, count], i) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{i + 1}. {name}</span>
                <span className="text-xs font-semibold text-slate-500">{count} shipment</span>
              </div>
            ))}
            {topDestinations.length === 0 && <p className="text-sm text-slate-400">Belum ada data</p>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 pb-3">
          <h2 className="text-sm font-bold text-slate-900">Detail Shipment Terbaru</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Resi</th>
                <th className="px-4 py-3">Pengirim</th>
                <th className="px-4 py-3">Penerima</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {lastShipments.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs text-brand-600">{s.trackingNumber}</td>
                  <td className="px-4 py-2.5 text-slate-700">{s.sender.name}</td>
                  <td className="px-4 py-2.5 text-slate-700">{s.receiver.name}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-2.5 text-slate-600">{s.assignments[0]?.driver.name || '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{new Date(s.createdAt).toLocaleString('id-ID')}</td>
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}