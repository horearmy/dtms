'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Search, ChevronLeft, ChevronRight, ArrowUpCircle, X, CheckCircle2, AlertCircle } from 'lucide-react';

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  contactEmail: string | null;
  active: boolean;
  createdAt: string;
  subscription: {
    status: string;
    billingCycle: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEndsAt: string | null;
    cancelledAt: string | null;
  } | null;
};

type PlanInfo = {
  id: string;
  code: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  subscribers?: number;
};

type PlanOption = { id: string; name: string; code: string; priceMonthly: number; priceYearly: number };

function rupiah(n: number) {
  return n === 0 ? 'Gratis' : `Rp ${n.toLocaleString('id-ID')}`;
}

const PLAN_ORDER = ['FREE', 'STARTER', 'GROWTH', 'PRO', 'ENTERPRISE'];

export default function PlanTenants({ planCode }: { planCode: string }) {
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal upgrade
  const [upgradeTarget, setUpgradeTarget] = useState<TenantRow | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedCycle, setSelectedCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const fetchData = useCallback(async (p: number, search: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/superadmin/billing/${planCode}/tenants?page=${p}&pageSize=20&q=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan);
        setTenants(data.tenants || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        setError('Gagal memuat daftar tenant');
      }
    } catch {
      setError('Gagal memuat daftar tenant');
    }
    setLoading(false);
  }, [planCode]);

  useEffect(() => { fetchData(page, q); }, [fetchData, page, q]);

  // Muat opsi plan untuk modal upgrade
  useEffect(() => {
    fetch('/api/superadmin/billing')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPlans(d.plans || []))
      .catch(() => {});
  }, []);

  function openUpgrade(t: TenantRow) {
    setUpgradeTarget(t);
    setSelectedPlan('');
    setSelectedCycle('MONTHLY');
  }

  async function submitUpgrade() {
    if (!upgradeTarget || !selectedPlan) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/superadmin/billing/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: upgradeTarget.id, planCode: selectedPlan, billingCycle: selectedCycle }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setToast({ ok: true, msg: data.message || 'Plan berhasil diubah' });
        setUpgradeTarget(null);
        fetchData(page, q);
      } else {
        setToast({ ok: false, msg: data.error || 'Gagal mengubah plan' });
      }
    } catch {
      setToast({ ok: false, msg: 'Gagal mengubah plan' });
    }
    setSubmitting(false);
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <div className="space-y-4">
      <Link href="/billing-management" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700">
        <ArrowLeft size={15} /> Kembali ke Billing Management
      </Link>

      {/* Header plan */}
      {plan && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Paket {plan.name} <span className="ml-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{plan.code}</span>
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {rupiah(plan.priceMonthly)}/bulan · {rupiah(plan.priceYearly)}/tahun
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{total.toLocaleString('id-ID')}</div>
              <div className="text-xs uppercase tracking-wide text-gray-400">Tenant Terdaftar</div>
            </div>
          </div>
        </div>
      )}

      {/* Pencarian */}
      <div className="relative w-full max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => { setPage(1); setQ(e.target.value); }}
          placeholder="Cari nama / kode tenant..."
          className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {toast && (
        <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${toast.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-600'}`}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.msg}
        </div>
      )}

      {/* Tabel */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Memuat...</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-500">{error}</div>
        ) : tenants.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Tidak ada tenant pada paket ini.</div>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3 font-semibold">Tenant</th>
                <th className="px-5 py-3 font-semibold">Kode</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Siklus</th>
                <th className="px-5 py-3 font-semibold">Periode Berakhir</th>
                <th className="px-5 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => {
                const sub = t.subscription;
                const isTrial = sub?.trialEndsAt && new Date(sub.trialEndsAt) > new Date();
                return (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-gray-900">{t.name}</div>
                      <div className="text-xs text-gray-400">{t.contactEmail || t.slug}</div>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-600">{t.code || '-'}</td>
                    <td className="px-5 py-3">
                      {!sub ? (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">Tanpa Langganan</span>
                      ) : isTrial ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600">Uji Coba</span>
                      ) : sub.status === 'ACTIVE' ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600">Aktif</span>
                      ) : sub.status === 'CANCELLED' ? (
                        <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-500">Dibatalkan</span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">{sub.status}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{sub ? (sub.billingCycle === 'YEARLY' ? 'Tahunan' : 'Bulanan') : '-'}</td>
                    <td className="px-5 py-3 text-gray-600">{sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('id-ID') : '-'}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => openUpgrade(t)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                      >
                        <ArrowUpCircle size={13} /> Ubah Plan
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginasi */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Halaman {page} dari {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40">
              <ChevronLeft size={14} /> Sebelumnya
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40">
              Selanjutnya <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Modal Ubah Plan */}
      {upgradeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Ubah Plan</h3>
                <p className="mt-0.5 text-sm text-gray-500">{upgradeTarget.name}</p>
              </div>
              <button onClick={() => setUpgradeTarget(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Paket Baru</label>
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">-- Pilih paket --</option>
              {[...plans]
                .sort((a, b) => PLAN_ORDER.indexOf(a.code) - PLAN_ORDER.indexOf(b.code))
                .map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.name} — {rupiah(p.priceMonthly)}/bln atau {rupiah(p.priceYearly)}/thn
                  </option>
                ))}
            </select>

            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Siklus Tagihan</label>
            <div className="mb-5 flex gap-2">
              <button
                onClick={() => setSelectedCycle('MONTHLY')}
                className={`flex-1 rounded-lg border-2 py-2 text-sm font-medium transition ${selectedCycle === 'MONTHLY' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                Bulanan
              </button>
              <button
                onClick={() => setSelectedCycle('YEARLY')}
                className={`flex-1 rounded-lg border-2 py-2 text-sm font-medium transition ${selectedCycle === 'YEARLY' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                Tahunan <span className="text-[10px] text-green-500">Hemat ~17%</span>
              </button>
            </div>

            <p className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
              Upgrade berlaku segera: kuota tenant disesuaikan dengan paket baru dan invoice otomatis dibuat untuk paket berbayar. Downgrade hanya dapat dilakukan setelah masa langganan tenant berakhir.
            </p>

            {(() => {
              const selIdx = PLAN_ORDER.indexOf(selectedPlan);
              const curIdx = PLAN_ORDER.indexOf(planCode);
              if (selIdx === -1 || selIdx >= curIdx) return null;
              const sub = upgradeTarget?.subscription;
              const active = sub?.status === 'ACTIVE' && sub?.currentPeriodEnd && new Date(sub.currentPeriodEnd) > new Date();
              return (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">
                  {active
                    ? `Tidak dapat downgrade: masa langganan ${upgradeTarget?.name} masih aktif sampai ${new Date(sub!.currentPeriodEnd).toLocaleDateString('id-ID')}.`
                    : 'Perhatian: ini adalah penurunan paket. Kuota dan fitur tenant akan langsung dikurangi.'}
                </div>
              );
            })()}

            <div className="flex gap-2">
              <button onClick={() => setUpgradeTarget(null)} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Batal
              </button>
              <button
                onClick={submitUpgrade}
                disabled={!selectedPlan || submitting || (() => {
                  const selIdx = PLAN_ORDER.indexOf(selectedPlan);
                  const curIdx = PLAN_ORDER.indexOf(planCode);
                  if (selIdx === -1 || selIdx >= curIdx) return false;
                  const sub = upgradeTarget?.subscription;
                  return sub?.status === 'ACTIVE' && !!sub?.currentPeriodEnd && new Date(sub.currentPeriodEnd) > new Date();
                })()}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Memproses...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
