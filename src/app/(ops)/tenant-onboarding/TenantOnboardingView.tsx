"use client";

import { useEffect, useState } from 'react';

type Tenant = { id: string; name: string; slug: string; status: string };
type OnboardingStep = { step: string; label: string; description: string | null; status: string; order: number; completedAt: string | null };

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  PENDING: 'bg-gray-100 text-gray-500',
  SKIPPED: 'bg-yellow-100 text-yellow-700',
  FAILED: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Selesai',
  IN_PROGRESS: 'Dikerjakan',
  PENDING: 'Belum Mulai',
  SKIPPED: 'Dilewati',
  FAILED: 'Gagal',
};

export default function TenantOnboardingView() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/tenants').then(r => r.json()).then(d => { const list = Array.isArray(d) ? d : d.tenants || []; if (Array.isArray(list)) setTenants(list); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) { setSteps([]); setProgress(0); return; }
    setLoading(true);
    fetch(`/api/tenants/${selectedId}/onboarding`)
      .then(r => r.json())
      .then(d => { setSteps(d.steps || []); setProgress(d.progress || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedId]);

  async function updateStep(step: string, status: string) {
    if (!selectedId) return;
    await fetch(`/api/tenants/${selectedId}/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step, status }),
    });
    const r = await fetch(`/api/tenants/${selectedId}/onboarding`);
    const d = await r.json();
    setSteps(d.steps || []);
    setProgress(d.progress || 0);
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Pilih Tenant</label>
        <select className="w-full max-w-md rounded-lg border px-3 py-2 text-sm" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
          <option value="">-- Pilih Tenant --</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.status})</option>)}
        </select>
      </div>

      {loading && <div className="text-sm text-[#667085]">Memuat data onboarding...</div>}

      {selectedId && steps.length > 0 && (
        <>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-[#101828]">Progress Onboarding</h3>
              <span className="text-sm font-bold text-[#2563eb]">{progress}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-100">
              <div className="h-3 rounded-full bg-[#2563eb] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="space-y-3">
            {steps.map((s, i) => (
              <div key={s.step} className="flex items-center gap-4 rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-[#101828]">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[#101828]">{s.label}</div>
                  {s.description && <div className="text-xs text-[#667085]">{s.description}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status] || STATUS_COLORS.PENDING}`}>
                    {STATUS_LABELS[s.status] || s.status}
                  </span>
                  {s.status !== 'COMPLETED' && (
                    <button
                      onClick={() => updateStep(s.step, 'COMPLETED')}
                      className="rounded-lg bg-green-500 px-2.5 py-1 text-xs text-white hover:bg-green-600"
                    >
                      Tandai Selesai
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedId && steps.length === 0 && !loading && (
        <div className="rounded-xl border bg-white p-12 text-center text-sm text-[#667085]">
          Klik tombol untuk memulai onboarding tenant ini.
        </div>
      )}
    </div>
  );
}
