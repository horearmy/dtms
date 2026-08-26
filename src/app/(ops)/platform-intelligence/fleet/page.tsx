'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { Car, Truck, Users, MapPin, AlertTriangle, RefreshCw, Wrench, TrendingUp, Clock } from 'lucide-react';
import KPICard from '@/components/platform/KPICard';
import ExecutiveInsights from '@/components/platform/ExecutiveInsights';

type FleetData = {
  period: { from: string; to: string };
  vehicle: { total: number; inUse: number; available: number; maintenance: number; idle: number; utilizationRate: number; totalDistanceKm: number };
  driver: { total: number; active: number; withGpsActivity: number; utilizationRate: number };
  assignment: { total: number; growthPct: number };
  gps: { totalLogs: number; growthPct: number; avgSpeed: number };
  maintenance: { recentCount: number; totalCost: number; records: { id: string; vehicleId: string; type: string; performedAt: string; cost: number; odometerKm: number }[] };
  idle: { id: string; vehicleNumber: string; type: string }[];
  trend: { date: string; count: number }[];
  topDrivers: { id: string; name: string; employeeId: string; assignmentCount: number }[];
  topVehicles: { id: string; vehicleNumber: string; type: string; status: string; distanceKm: number; assignmentCount: number }[];
  insights: { type: string; text: string }[];
};

const VEHICLE_STATUS_COLORS: Record<string, string> = { IN_USE: '#16B364', AVAILABLE: '#0D6EFD', MAINTENANCE: '#FF8A00', RETIRED: '#667085' };

const PRESETS = [
  { value: 'this_month', label: 'Bulan Ini' }, { value: 'last_30_days', label: '30 Hari' },
  { value: 'last_7_days', label: '7 Hari' }, { value: 'today', label: 'Hari Ini' },
  { value: 'this_quarter', label: 'Kuartal Ini' }, { value: 'this_year', label: 'Tahun Ini' },
];

export default function FleetAnalyticsPage() {
  const [data, setData] = useState<FleetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preset, setPreset] = useState('this_month');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (p: string) => {
    try {
      const res = await fetch(`/api/platform/reports/fleet?preset=${p}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError('');
    } catch (e: any) { setError(e.message || 'Gagal memuat data'); }
  }, []);

  useEffect(() => { setLoading(true); fetchData(preset).finally(() => setLoading(false)); }, [preset, fetchData]);

  const handleRefresh = async () => { setRefreshing(true); await fetchData(preset); setRefreshing(false); };

  if (loading && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#0D6EFD] border-t-transparent" />
          <p className="text-sm text-[#667085]">Memuat fleet analytics...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="rounded-xl border border-[#FEE4E2] bg-[#FEF3F2] p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 text-[#F5222D]" size={32} />
          <p className="text-sm font-semibold text-[#F5222D]">{error}</p>
          <button onClick={() => fetchData(preset)} className="mt-3 rounded-lg bg-[#0D6EFD] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B5ED7]">Coba Lagi</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const vehiclePieData = [
    { name: 'In Use', value: data.vehicle.inUse, fill: VEHICLE_STATUS_COLORS.IN_USE },
    { name: 'Available', value: data.vehicle.available, fill: VEHICLE_STATUS_COLORS.AVAILABLE },
    { name: 'Maintenance', value: data.vehicle.maintenance, fill: VEHICLE_STATUS_COLORS.MAINTENANCE },
  ].filter((d) => d.value > 0);

  const driverPieData = [
    { name: 'With GPS', value: data.driver.withGpsActivity, fill: '#16B364' },
    { name: 'No GPS', value: data.driver.active - data.driver.withGpsActivity, fill: '#E4E7EC' },
  ].filter((d) => d.value > 0);

  const RADIAN = Math.PI / 180;
  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{`${(percent * 100).toFixed(0)}%`}</text>;
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#101828]">Fleet Analytics</h1>
          <p className="text-xs text-[#667085]">Utilisasi kendaraan, driver, GPS tracking, dan maintenance</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={preset} onChange={(e) => setPreset(e.target.value)}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-xs font-semibold text-[#101828] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:border-[#0D6EFD] focus:outline-none">
            {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <button onClick={handleRefresh} disabled={refreshing}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-xs font-semibold text-[#101828] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-[#F7F9FC] disabled:opacity-50">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Row 1: Vehicle */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KPICard label="Total Kendaraan" value={data.vehicle.total} icon={<Car size={18} />} color="#0D6EFD" subtitle={`${data.vehicle.inUse} in use`} />
        <KPICard label="Utilization Rate" value={`${data.vehicle.utilizationRate}%`} icon={<TrendingUp size={18} />} color={data.vehicle.utilizationRate > 85 ? '#F5222D' : '#16B364'} />
        <KPICard label="Idle (>7 hari)" value={data.vehicle.idle} icon={<Clock size={18} />} color="#FF8A00" />
        <KPICard label="Total Distance" value={`${data.vehicle.totalDistanceKm.toLocaleString('id-ID')} km`} icon={<MapPin size={18} />} color="#7C3AED" />
        <KPICard label="Assignment" value={data.assignment.total} changePct={data.assignment.growthPct} icon={<Truck size={18} />} color="#16B364" />
        <KPICard label="Avg Speed" value={`${data.gps.avgSpeed} km/h`} icon={<MapPin size={18} />} color="#0D6EFD" subtitle={`${data.gps.totalLogs.toLocaleString('id-ID')} GPS logs`} />
      </div>

      {/* KPI Row 2: Driver + Maintenance */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard label="Total Driver" value={data.driver.total} icon={<Users size={18} />} color="#0D6EFD" subtitle={`${data.driver.active} aktif`} />
        <KPICard label="Driver GPS Active" value={`${data.driver.utilizationRate}%`} icon={<MapPin size={18} />} color="#16B364" subtitle={`${data.driver.withGpsActivity}/${data.driver.active}`} />
        <KPICard label="Maintenance (Periode)" value={data.maintenance.recentCount} icon={<Wrench size={18} />} color="#FF8A00" subtitle={`Rp ${(data.maintenance.totalCost / 1_000_000).toFixed(1)}M total`} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Vehicle Status Pie */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Vehicle Status Distribution</h3>
          {vehiclePieData.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada kendaraan</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={vehiclePieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" labelLine={false} label={renderPieLabel}>
                  {vehiclePieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Driver GPS Activity Pie */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Driver GPS Activity</h3>
          {driverPieData.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada driver</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={driverPieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" labelLine={false} label={renderPieLabel}>
                  {driverPieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Assignment Trend */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Assignment Trend</h3>
          {data.trend.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.trend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#667085' }} />
                <YAxis tick={{ fontSize: 10, fill: '#667085' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }} />
                <Line type="monotone" dataKey="count" stroke="#0D6EFD" strokeWidth={2} dot={{ r: 3, fill: '#0D6EFD' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Vehicles Bar */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Top Vehicles by Assignment</h3>
          {data.topVehicles.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.topVehicles.map((v) => ({ name: v.vehicleNumber, count: v.assignmentCount, distance: v.distanceKm }))} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#667085' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#667085' }} width={80} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#0D6EFD" name="Assignments" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Drivers Table */}
      <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h3 className="mb-4 text-sm font-bold text-[#101828]">Top Drivers by Assignment</h3>
        {data.topDrivers.length === 0 ? (
          <p className="py-4 text-center text-xs text-[#667085]">Tidak ada data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E7EC]">
                  <th className="pb-2 font-semibold text-[#667085]">Driver</th>
                  <th className="pb-2 font-semibold text-[#667085]">Employee ID</th>
                  <th className="pb-2 text-right font-semibold text-[#667085]">Assignments</th>
                  <th className="pb-2 font-semibold text-[#667085]">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {data.topDrivers.map((d) => {
                  const maxCount = data.topDrivers[0]?.assignmentCount || 1;
                  return (
                    <tr key={d.id} className="border-b border-[#F7F9FC]">
                      <td className="py-2 font-semibold text-[#101828]">{d.name}</td>
                      <td className="py-2 text-[#667085]">{d.employeeId}</td>
                      <td className="py-2 text-right font-semibold text-[#101828]">{d.assignmentCount}</td>
                      <td className="py-2">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[#F7F9FC]">
                          <div className="h-full rounded-full bg-[#16B364]" style={{ width: `${(d.assignmentCount / maxCount) * 100}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Idle Vehicles */}
      {data.idle.length > 0 && (
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mb-4 flex items-center gap-2">
            <Clock size={16} className="text-[#FF8A00]" />
            <h3 className="text-sm font-bold text-[#101828]">Idle Vehicles (&gt;7 hari tanpa GPS)</h3>
            <span className="rounded-full bg-[#FF8A00] px-2 py-0.5 text-[10px] font-bold text-white">{data.idle.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E7EC]">
                  <th className="pb-2 font-semibold text-[#667085]">No. Kendaraan</th>
                  <th className="pb-2 font-semibold text-[#667085]">Tipe</th>
                </tr>
              </thead>
              <tbody>
                {data.idle.map((v) => (
                  <tr key={v.id} className="border-b border-[#F7F9FC]">
                    <td className="py-2 font-semibold text-[#101828]">{v.vehicleNumber}</td>
                    <td className="py-2 text-[#667085]">{v.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Maintenance Records */}
      {data.maintenance.records.length > 0 && (
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Recent Maintenance Records</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E7EC]">
                  <th className="pb-2 font-semibold text-[#667085]">Type</th>
                  <th className="pb-2 font-semibold text-[#667085]">Performed</th>
                  <th className="pb-2 text-right font-semibold text-[#667085]">Odometer</th>
                  <th className="pb-2 text-right font-semibold text-[#667085]">Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.maintenance.records.map((m) => (
                  <tr key={m.id} className="border-b border-[#F7F9FC]">
                    <td className="py-2 font-semibold text-[#101828]">{m.type}</td>
                    <td className="py-2 text-[#667085]">{new Date(m.performedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="py-2 text-right text-[#667085]">{m.odometerKm > 0 ? `${m.odometerKm.toLocaleString('id-ID')} km` : '-'}</td>
                    <td className="py-2 text-right text-[#101828]">{m.cost > 0 ? `Rp ${(m.cost / 1000).toFixed(0)}K` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Insights */}
      <ExecutiveInsights insights={data.insights} />
    </div>
  );
}
