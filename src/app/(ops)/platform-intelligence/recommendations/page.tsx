'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from '@/components/recharts-lazy';
import { Lightbulb, TrendingUp, ShieldAlert, DollarSign, Cog, Zap, RefreshCw, Filter, Send, X } from 'lucide-react';
import { useNotification } from '@/components/ui/NotificationContext';

type Recommendation = {
  id: string; category: string; priority: string; title: string;
  description: string; impact: string; action: string; metric?: string; tenantId?: string; tenantName?: string;
};
type RecData = {
  recommendations: Recommendation[];
  summary: { total: number; critical: number; high: number; medium: number; low: number;
    byCategory: Record<string, number>;
  };
};

const PRIORITY_COLORS: Record<string, string> = { CRITICAL: '#F5222D', HIGH: '#FF8A00', MEDIUM: '#0D6EFD', LOW: '#16B364' };
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  revenue: <DollarSign size={14} />, operations: <Cog size={14} />,
  growth: <TrendingUp size={14} />, risk: <ShieldAlert size={14} />, efficiency: <Zap size={14} />,
};
const CATEGORY_COLORS: Record<string, string> = { revenue: '#7C3AED', operations: '#0D6EFD', growth: '#16B364', risk: '#F5222D', efficiency: '#FF8A00' };

const ACTIONABLE_RECS = ['growth', 'revenue', 'risk'];

const DEFAULT_MESSAGES: Record<string, { title: string; message: string }> = {
  growth: {
    title: 'Upgrade Plan Tersedia',
    message: 'Halo! Kami melihat Anda telah menggunakan sebagian besar kuota shipment. Kami menawarkan upgrade ke plan yang lebih tinggi untuk menikmati kuota lebih besar, fitur premium, dan dukungan prioritas. Silakan hubungi kami untuk informasi lebih lanjut.',
  },
  revenue: {
    title: 'Pengingat Pembayaran',
    message: 'Kami perhatikan ada invoice yang telah jatuh tempo. Mohon segera lakukan pembayaran untuk menghindari gangguan layanan. Jika Anda membutuhkan bantuan, tim kami siap membantu.',
  },
  risk: {
    title: 'Perhatian: Aktivitas Terdeteksi',
    message: 'Kami mendeteksi potensi risiko pada operasional Anda. Tim kami ingin membantu memastikan kelancaran operasional. Silakan hubungi kami untuk diskusi lebih lanjut.',
  },
};

export default function RecommendationsPage() {
  const { success, error: notifyError } = useNotification();
  const [data, setData] = useState<RecData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [catFilter, setCatFilter] = useState('all');
  const [prioFilter, setPrioFilter] = useState('all');

  const [sendModal, setSendModal] = useState<{ open: boolean; rec: Recommendation | null }>({ open: false, rec: null });
  const [sendTitle, setSendTitle] = useState('');
  const [sendMsg, setSendMsg] = useState('');
  const [sending, setSending] = useState(false);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/platform/reports/recommendations', { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError('');
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setError(e.message || 'Gagal memuat data');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchData(controller.signal).finally(() => setLoading(false));
    return () => controller.abort();
  }, [fetchData]);

  const handleRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const openSendModal = (rec: Recommendation) => {
    const defaults = DEFAULT_MESSAGES[rec.category] || DEFAULT_MESSAGES.growth;
    setSendTitle(defaults.title);
    setSendMsg(defaults.message);
    setSendModal({ open: true, rec });
  };

  const handleSend = async () => {
    if (!sendModal.rec?.tenantId || !sendTitle.trim() || !sendMsg.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: sendModal.rec.tenantId,
          title: sendTitle.trim(),
          message: sendMsg.trim(),
          type: sendModal.rec.category === 'growth' ? 'UPGRADE' : 'WARNING',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      success(`Notifikasi terkirim ke ${result.tenantName} (${result.sent} user)`);
      setSendModal({ open: false, rec: null });
    } catch (e: any) {
      notifyError('Gagal mengirim notifikasi', e.message);
    } finally {
      setSending(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#0D6EFD] border-t-transparent" />
          <p className="text-sm text-[#667085]">Memuat rekomendasi...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <ShieldAlert size={32} className="mx-auto mb-3 text-[#F5222D]" />
          <p className="text-sm font-semibold text-[#F5222D]">{error}</p>
          <button onClick={handleRefresh} className="mt-3 rounded-lg bg-[#0D6EFD] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B5ED7]">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const filtered = data.recommendations.filter((r) =>
    (catFilter === 'all' || r.category === catFilter) && (prioFilter === 'all' || r.priority === prioFilter)
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#101828]">Recommendation Engine</h1>
          <p className="text-xs text-[#667085]">Rekomendasi actionable berdasarkan analisis data platform</p>
        </div>
        <button onClick={handleRefresh}
          className="flex items-center gap-1 rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-semibold text-[#667085] hover:bg-[#F7F9FC]"
          disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <div className="flex items-center gap-2"><Lightbulb size={16} className="text-[#FF8A00]" /><p className="text-[10px] font-semibold uppercase text-[#667085]">Total Rekomendasi</p></div>
          <p className="mt-1 text-2xl font-bold text-[#101828]">{data.summary.total}</p>
        </div>
        <div className="rounded-xl border border-[#F5222D]/20 bg-[#F5222D]/5 p-4">
          <p className="text-[10px] font-semibold uppercase text-[#F5222D]">Critical</p>
          <p className="mt-1 text-2xl font-bold text-[#F5222D]">{data.summary.critical}</p>
        </div>
        <div className="rounded-xl border border-[#FF8A00]/20 bg-[#FF8A00]/5 p-4">
          <p className="text-[10px] font-semibold uppercase text-[#FF8A00]">High</p>
          <p className="mt-1 text-2xl font-bold text-[#FF8A00]">{data.summary.high}</p>
        </div>
        <div className="rounded-xl border border-[#0D6EFD]/20 bg-[#0D6EFD]/5 p-4">
          <p className="text-[10px] font-semibold uppercase text-[#0D6EFD]">Medium + Low</p>
          <p className="mt-1 text-2xl font-bold text-[#0D6EFD]">{data.summary.medium + data.summary.low}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-[#101828]">By Category</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={Object.entries(data.summary.byCategory).map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), count: v }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F7F9FC" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#667085' }} />
              <YAxis tick={{ fontSize: 10, fill: '#667085' }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {Object.keys(data.summary.byCategory).map((k) => <Cell key={k} fill={CATEGORY_COLORS[k] || '#667085'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-[#101828]">By Priority</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={[{ name: 'Critical', value: data.summary.critical }, { name: 'High', value: data.summary.high }, { name: 'Medium', value: data.summary.medium }, { name: 'Low', value: data.summary.low }].filter((d) => d.value > 0)}
                dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine>
                {(['Critical', 'High', 'Medium', 'Low'] as const).filter((k) => (data.summary as any)[k.toLowerCase()] > 0)
                  .map((k, i) => <Cell key={i} fill={PRIORITY_COLORS[k.toUpperCase()]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters + List */}
      <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Filter size={14} className="text-[#667085]" />
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
            className="rounded-lg border border-[#E4E7EC] px-2 py-1 text-[11px] text-[#101828] focus:border-[#0D6EFD] focus:outline-none">
            <option value="all">Semua Kategori</option>
            <option value="revenue">Revenue</option>
            <option value="operations">Operations</option>
            <option value="growth">Growth</option>
            <option value="risk">Risk</option>
            <option value="efficiency">Efficiency</option>
          </select>
          <select value={prioFilter} onChange={(e) => setPrioFilter(e.target.value)}
            className="rounded-lg border border-[#E4E7EC] px-2 py-1 text-[11px] text-[#101828] focus:border-[#0D6EFD] focus:outline-none">
            <option value="all">Semua Prioritas</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <span className="text-[10px] text-[#98A2B3]">{filtered.length} rekomendasi</span>
        </div>

        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada rekomendasi yang cocok</p>
          )}
          {filtered.map((r) => (
            <div key={r.id} className="flex items-start gap-3 rounded-lg border border-[#F7F9FC] p-3 hover:border-[#E4E7EC]">
              <div className="mt-0.5 flex-shrink-0 rounded-lg p-1.5" style={{ backgroundColor: `${CATEGORY_COLORS[r.category] || '#667085'}15`, color: CATEGORY_COLORS[r.category] || '#667085' }}>
                {CATEGORY_ICONS[r.category] || <Lightbulb size={14} />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block rounded px-1.5 py-px text-[9px] font-bold uppercase text-white" style={{ backgroundColor: PRIORITY_COLORS[r.priority] }}>
                    {r.priority}
                  </span>
                  <span className="text-[10px] text-[#667085]">{r.category}</span>
                  {r.tenantName && <span className="text-[10px] text-[#98A2B3]">&middot; {r.tenantName}</span>}
                </div>
                <p className="mt-1 text-xs font-bold text-[#101828]">{r.title}</p>
                <p className="mt-0.5 text-[10px] text-[#667085]">{r.description}</p>
                <div className="mt-2 flex gap-4">
                  <div>
                    <p className="text-[9px] font-semibold uppercase text-[#98A2B3]">Impact</p>
                    <p className="text-[10px] text-[#101828]">{r.impact}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase text-[#98A2B3]">Action</p>
                    <p className="text-[10px] text-[#101828]">{r.action}</p>
                  </div>
                </div>
                {r.metric && <p className="mt-1 text-[10px] font-semibold text-[#0D6EFD]">{r.metric}</p>}
              </div>
              {ACTIONABLE_RECS.includes(r.category) && r.tenantId && (
                <button onClick={() => openSendModal(r)}
                  className="mt-1 flex flex-shrink-0 items-center gap-1 rounded-lg border border-[#0D6EFD]/30 bg-[#0D6EFD]/5 px-2.5 py-1.5 text-[10px] font-semibold text-[#0D6EFD] hover:bg-[#0D6EFD]/10"
                  title="Kirim notifikasi ke tenant">
                  <Send size={12} /> Kirim
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Send Notification Modal */}
      {sendModal.open && sendModal.rec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSendModal({ open: false, rec: null })}>
          <div className="w-full max-w-lg rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#101828]">Kirim Notifikasi ke Tenant</h3>
                <p className="text-[10px] text-[#667085]">{sendModal.rec.tenantName}</p>
              </div>
              <button onClick={() => setSendModal({ open: false, rec: null })} className="rounded-lg p-1 hover:bg-[#F7F9FC]">
                <X size={16} className="text-[#667085]" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase text-[#667085]">Judul</label>
                <input value={sendTitle} onChange={(e) => setSendTitle(e.target.value)} maxLength={200}
                  className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs text-[#101828] focus:border-[#0D6EFD] focus:outline-none" />
                <p className="mt-0.5 text-right text-[9px] text-[#98A2B3]">{sendTitle.length}/200</p>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase text-[#667085]">Pesan</label>
                <textarea value={sendMsg} onChange={(e) => setSendMsg(e.target.value)} rows={5} maxLength={2000}
                  className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs text-[#101828] focus:border-[#0D6EFD] focus:outline-none" />
                <p className="mt-0.5 text-right text-[9px] text-[#98A2B3]">{sendMsg.length}/2000</p>
              </div>
              <div className="rounded-lg bg-[#F7F9FC] p-3">
                <p className="text-[9px] font-semibold uppercase text-[#667085]">Rekomendasi</p>
                <p className="mt-0.5 text-[10px] text-[#101828]">{sendModal.rec.title}</p>
                <p className="text-[10px] text-[#667085]">{sendModal.rec.action}</p>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setSendModal({ open: false, rec: null })}
                className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-semibold text-[#667085] hover:bg-[#F7F9FC]">
                Batal
              </button>
              <button onClick={handleSend} disabled={sending || !sendTitle.trim() || !sendMsg.trim()}
                className="flex items-center gap-1 rounded-lg bg-[#0D6EFD] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0B5ED7] disabled:opacity-50">
                <Send size={12} /> {sending ? 'Mengirim...' : 'Kirim Notifikasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
