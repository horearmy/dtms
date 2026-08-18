"use client";

import { useEffect, useState } from 'react';

type SlaPolicy = {
  id: string; name: string; serviceType: string; originCity: string | null; destCity: string | null;
  targetHours: number; cutoffTime: string | null; priority: number; active: boolean; createdAt: string;
};

const SERVICE_LABELS: Record<string, string> = { SAME_DAY: 'Same Day', NEXT_DAY: 'Next Day', REGULAR: 'Reguler' };

export default function SlaPolicies() {
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', serviceType: 'REGULAR', targetHours: '24', originCity: '', destCity: '', cutoffTime: '', priority: '0' });

  useEffect(() => { fetchPolicies(); }, []);

  async function fetchPolicies() {
    setLoading(true);
    const res = await fetch('/api/sla-policies');
    if (res.ok) setPolicies(await res.json());
    setLoading(false);
  }

  async function createPolicy(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    const res = await fetch('/api/sla-policies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, originCity: form.originCity || null, destCity: form.destCity || null, cutoffTime: form.cutoffTime || null }),
    });
    const result = await res.json();
    if (!res.ok) { setFormError(result.error || 'Gagal'); setSaving(false); return; }
    setShowForm(false);
    setForm({ name: '', serviceType: 'REGULAR', targetHours: '24', originCity: '', destCity: '', cutoffTime: '', priority: '0' });
    fetchPolicies();
  }

  return (
    <div>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h2 className="mb-4 text-lg font-bold text-[#101828]">SLA Policy Baru</h2>
            <form onSubmit={createPolicy} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#667085]">Nama *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#667085]">Layanan</label>
                  <select value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none">
                    {Object.entries(SERVICE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#667085]">Target Jam *</label>
                  <input type="number" min="1" required value={form.targetHours} onChange={(e) => setForm({ ...form, targetHours: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#667085]">Priority</label>
                  <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#667085]">Kota Asal</label>
                  <input value={form.originCity} onChange={(e) => setForm({ ...form, originCity: e.target.value })}
                    placeholder="Semua kota"
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#667085]">Kota Tujuan</label>
                  <input value={form.destCity} onChange={(e) => setForm({ ...form, destCity: e.target.value })}
                    placeholder="Semua kota"
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
              </div>
              {formError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</div>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-[#E4E7EC] px-4 py-2 text-sm text-[#667085] hover:bg-[#F7F9FC]">Batal</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-[#0D6EFD] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B5FD5] disabled:opacity-60">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mb-4 flex justify-end">
        <button onClick={() => setShowForm(true)} className="rounded-lg bg-[#0D6EFD] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B5FD5]">
          + Policy Baru
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-[#F7F9FC] text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Layanan</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Rute</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[#667085]">Memuat...</td></tr>
            ) : policies.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[#667085]">Belum ada policy</td></tr>
            ) : policies.map((p) => (
              <tr key={p.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                <td className="px-4 py-3 font-medium text-[#101828]">{p.name}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-[#F7F9FC] px-2 py-0.5 text-xs font-medium text-[#667085]">{SERVICE_LABELS[p.serviceType] || p.serviceType}</span></td>
                <td className="px-4 py-3 text-sm text-[#101828]">{p.targetHours} jam</td>
                <td className="px-4 py-3 text-xs text-[#667085]">{p.originCity || '*'} → {p.destCity || '*'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                    {p.active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
