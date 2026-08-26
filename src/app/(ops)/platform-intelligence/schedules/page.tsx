'use client';

import { useCallback, useEffect, useState } from 'react';
import { Calendar, Plus, Play, Trash2, RefreshCw, Clock, CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';
import KPICard from '@/components/platform/KPICard';
import { useNotification } from '@/components/ui/NotificationContext';

type Schedule = {
  id: string; name: string; reportType: string; dataset: string; dimension: string;
  metric: string; preset: string; format: string; schedule: string; timezone: string;
  recipients: string[]; active: boolean; lastRunAt: string | null; nextRunAt: string | null;
  jobCount: number; createdAt: string;
};

type Job = {
  id: string; status: string; fileUrl: string | null; error: string | null;
  createdAt: string; startedAt: string | null; completedAt: string | null;
};

const DATASETS = [
  { value: 'shipments', label: 'Shipments' }, { value: 'tenants', label: 'Tenants' },
  { value: 'customers', label: 'Customers' }, { value: 'drivers', label: 'Drivers' },
  { value: 'vehicles', label: 'Vehicles' }, { value: 'exceptions', label: 'Exceptions' },
  { value: 'invoices', label: 'Invoices' }, { value: 'integration_logs', label: 'Integration Logs' },
];

const SCHEDULES = [
  { value: 'daily 06:00', label: 'Harian (06:00)' },
  { value: 'weekly monday', label: 'Mingguan (Senin)' },
  { value: 'monthly 1', label: 'Bulanan (Tanggal 1)' },
];

const STATUS_ICONS: Record<string, React.ReactNode> = {
  QUEUED: <Clock size={12} className="text-[#FF8A00]" />,
  PROCESSING: <RefreshCw size={12} className="animate-spin text-[#0D6EFD]" />,
  COMPLETED: <CheckCircle2 size={12} className="text-[#16B364]" />,
  FAILED: <XCircle size={12} className="text-[#F5222D]" />,
};

export default function SchedulesPage() {
  const { success, error: notifyError } = useNotification();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<(Schedule & { jobs: Job[] }) | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', dataset: 'shipments', dimension: 'status', metric: 'count', preset: 'this_month', schedule: 'daily 06:00', format: 'csv' });

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch('/api/platform/reports/schedules');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSchedules(await res.json());
      setError('');
    } catch (e: any) { setError(e.message); }
  }, []);

  useEffect(() => { fetchSchedules().finally(() => setLoading(false)); }, [fetchSchedules]);

  const fetchDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/platform/reports/schedules/${id}`);
      if (res.ok) setDetail(await res.json());
    } catch {}
  };

  useEffect(() => { if (detailId) fetchDetail(detailId); }, [detailId]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/platform/reports/schedules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      success('Jadwal laporan berhasil dibuat');
      setShowCreate(false);
      setForm({ name: '', dataset: 'shipments', dimension: 'status', metric: 'count', preset: 'this_month', schedule: 'daily 06:00', format: 'csv' });
      await fetchSchedules();
    } catch (e: any) { notifyError('Gagal menjalankan laporan', e.message); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus scheduled report ini?')) return;
    await fetch(`/api/platform/reports/schedules/${id}`, { method: 'DELETE' });
    setDetailId(null);
    await fetchSchedules();
  };

  const handleTrigger = async (id: string) => {
    await fetch(`/api/platform/reports/schedules/${id}/trigger`, { method: 'POST' });
    if (detailId === id) await fetchDetail(id);
    await fetchSchedules();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await fetch(`/api/platform/reports/schedules/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    });
    await fetchSchedules();
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#0D6EFD] border-t-transparent" />
          <p className="text-sm text-[#667085]">Memuat scheduled reports...</p>
        </div>
      </div>
    );
  }

  const activeCount = schedules.filter((s) => s.active).length;
  const totalJobs = schedules.reduce((s, sc) => s + sc.jobCount, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#101828]">Scheduled Reports</h1>
          <p className="text-xs text-[#667085]">Jadwalkan laporan otomatis harian, mingguan, atau bulanan</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 rounded-lg bg-[#0D6EFD] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0B5ED7]">
          <Plus size={14} /> Buat Jadwal
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KPICard label="Total Schedule" value={schedules.length} icon={<Calendar size={18} />} color="#0D6EFD" />
        <KPICard label="Active" value={activeCount} icon={<CheckCircle2 size={18} />} color="#16B364" />
        <KPICard label="Total Jobs Run" value={totalJobs} icon={<Play size={18} />} color="#7C3AED" />
      </div>

      {error && (
        <div className="rounded-xl border border-[#F5222D]/20 bg-[#F5222D]/5 px-4 py-3 text-xs text-[#F5222D]">{error}</div>
      )}

      {/* Schedule List */}
      <div className="space-y-2">
        {schedules.length === 0 && (
          <div className="rounded-xl border border-[#E4E7EC] bg-white p-12 text-center">
            <Calendar size={32} className="mx-auto mb-2 text-[#D0D5DD]" />
            <p className="text-sm font-semibold text-[#667085]">Belum ada scheduled report</p>
            <p className="text-xs text-[#98A2B3]">Klik "Buat Jadwal" untuk membuat jadwal laporan baru</p>
          </div>
        )}
        {schedules.map((s) => (
          <div key={s.id} className={`rounded-xl border bg-white p-4 transition ${detailId === s.id ? 'border-[#0D6EFD]' : 'border-[#E4E7EC] hover:border-[#D0D5DD]'}`}>
            <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${s.active ? 'bg-[#16B364]' : 'bg-[#D0D5DD]'}`} />
              <div className="flex-1">
                <p className="text-sm font-bold text-[#101828]">{s.name}</p>
                <p className="text-[10px] text-[#667085]">
                  {s.dataset} &middot; {s.schedule} &middot; {s.format.toUpperCase()}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#98A2B3]">{s.jobCount} runs</span>
                <button onClick={() => handleTrigger(s.id)} className="rounded-lg p-1.5 text-[#16B364] hover:bg-[#16B364]/10" title="Run now">
                  <Play size={14} />
                </button>
                <button onClick={() => handleToggle(s.id, s.active)} className={`rounded-lg p-1.5 ${s.active ? 'text-[#FF8A00]' : 'text-[#16B364]'} hover:bg-[#F7F9FC]`} title={s.active ? 'Pause' : 'Enable'}>
                  {s.active ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                </button>
                <button onClick={() => handleDelete(s.id)} className="rounded-lg p-1.5 text-[#F5222D] hover:bg-[#F5222D]/10" title="Delete">
                  <Trash2 size={14} />
                </button>
                <button onClick={() => setDetailId(detailId === s.id ? null : s.id)} className="rounded-lg p-1.5 text-[#667085] hover:bg-[#F7F9FC]">
                  <AlertCircle size={14} />
                </button>
              </div>
            </div>
            {s.lastRunAt && (
              <p className="mt-1 text-[10px] text-[#98A2B3]">Last run: {new Date(s.lastRunAt).toLocaleString('id-ID')}</p>
            )}

            {/* Detail Panel */}
            {detailId === s.id && detail && detail.id === s.id && (
              <div className="mt-3 border-t border-[#F7F9FC] pt-3">
                <div className="mb-2 grid grid-cols-3 gap-2 text-[10px]">
                  <div><span className="text-[#98A2B3]">Dataset:</span> <span className="font-semibold text-[#101828]">{detail.dataset}</span></div>
                  <div><span className="text-[#98A2B3]">Dimension:</span> <span className="font-semibold text-[#101828]">{detail.dimension}</span></div>
                  <div><span className="text-[#98A2B3]">Metric:</span> <span className="font-semibold text-[#101828]">{detail.metric}</span></div>
                </div>
                {detail.jobs.length > 0 && (
                  <div>
                    <p className="mb-1 text-[10px] font-semibold text-[#667085]">Recent Jobs</p>
                    <div className="space-y-1">
                      {detail.jobs.slice(0, 5).map((j) => (
                        <div key={j.id} className="flex items-center justify-between rounded-lg bg-[#F7F9FC] px-2 py-1.5 text-[10px]">
                          <div className="flex items-center gap-1.5">
                            {STATUS_ICONS[j.status]}
                            <span className="text-[#101828]">{j.status}</span>
                          </div>
                          <span className="text-[#98A2B3]">{new Date(j.createdAt).toLocaleString('id-ID')}</span>
                          {j.fileUrl && (
                            <a href={j.fileUrl} className="text-[#0D6EFD] hover:underline">Download</a>
                          )}
                          {j.error && <span className="text-[#F5222D]">{j.error}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {detail.jobs.length === 0 && (
                  <p className="text-[10px] text-[#98A2B3]">Belum ada job yang dijalankan</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="mx-4 w-full max-w-lg rounded-xl border border-[#E4E7EC] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#E4E7EC] px-5 py-4">
              <h2 className="text-sm font-bold text-[#101828]">Buat Scheduled Report</h2>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1.5 text-[#667085] hover:bg-[#F7F9FC]"><X size={18} /></button>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase text-[#667085]">Nama</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Contoh: Weekly Shipment Report"
                  className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs text-[#101828] focus:border-[#0D6EFD] focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-[#667085]">Dataset</label>
                  <select value={form.dataset} onChange={(e) => setForm({ ...form, dataset: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs text-[#101828] focus:border-[#0D6EFD] focus:outline-none">
                    {DATASETS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-[#667085]">Schedule</label>
                  <select value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs text-[#101828] focus:border-[#0D6EFD] focus:outline-none">
                    {SCHEDULES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-[#667085]">Dimension</label>
                  <select value={form.dimension} onChange={(e) => setForm({ ...form, dimension: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs text-[#101828] focus:border-[#0D6EFD] focus:outline-none">
                    <option value="status">Status</option>
                    <option value="serviceType">Service Type</option>
                    <option value="origin">Origin</option>
                    <option value="destination">Destination</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-[#667085]">Metric</label>
                  <select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs text-[#101828] focus:border-[#0D6EFD] focus:outline-none">
                    <option value="count">Count</option>
                    <option value="total_billed">Total Billed</option>
                    <option value="total_paid">Total Paid</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-[#667085]">Format</label>
                  <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs text-[#101828] focus:border-[#0D6EFD] focus:outline-none">
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#E4E7EC] px-5 py-3">
              <button onClick={() => setShowCreate(false)} className="rounded-lg px-3 py-2 text-xs font-semibold text-[#667085] hover:bg-[#F7F9FC]">Batal</button>
              <button onClick={handleCreate} disabled={creating || !form.name}
                className="rounded-lg bg-[#0D6EFD] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B5ED7] disabled:opacity-50">
                {creating ? 'Membuat...' : 'Buat Jadwal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
