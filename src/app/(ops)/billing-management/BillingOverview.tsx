'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Building2, TrendingUp, Users, Wallet, ChevronRight } from 'lucide-react';

type PlanCard = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  trialDays: number;
  maxUsers: number;
  maxDrivers: number;
  maxShipments: number;
  maxStorageMb: number;
  subscribers: number;
  mrr: number;
};

type Summary = {
  totalTenants: number;
  activeSubscriptions: number;
  estimatedMrr: number;
};

function rupiah(n: number) {
  return n === 0 ? 'Gratis' : `Rp ${n.toLocaleString('id-ID')}`;
}

const PLAN_COLORS: Record<string, string> = {
  FREE: 'border-gray-200 bg-white hover:border-blue-200',
  STARTER: 'border-blue-100 bg-blue-50/40 hover:border-blue-300',
  GROWTH: 'border-indigo-200 bg-indigo-50/40 hover:border-indigo-400',
  PRO: 'border-purple-200 bg-purple-50/40 hover:border-purple-400',
  ENTERPRISE: 'border-amber-200 bg-amber-50/40 hover:border-amber-400',
};

export default function BillingOverview() {
  const [plans, setPlans] = useState<PlanCard[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/superadmin/billing');
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
        setSummary(data.summary || null);
      } else {
        setError('Gagal memuat data billing');
      }
    } catch {
      setError('Gagal memuat data billing');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Memuat data billing...</div>;
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>;

  return (
    <div className="space-y-6">
      {/* Ringkasan */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5">
            <div className="rounded-lg bg-blue-50 p-3"><Building2 size={20} className="text-blue-600" /></div>
            <div>
              <div className="text-xs text-gray-500">Total Tenant</div>
              <div className="text-xl font-bold text-gray-900">{summary.totalTenants.toLocaleString('id-ID')}</div>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5">
            <div className="rounded-lg bg-emerald-50 p-3"><Users size={20} className="text-emerald-600" /></div>
            <div>
              <div className="text-xs text-gray-500">Langganan Aktif</div>
              <div className="text-xl font-bold text-gray-900">{summary.activeSubscriptions.toLocaleString('id-ID')}</div>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5">
            <div className="rounded-lg bg-amber-50 p-3"><Wallet size={20} className="text-amber-600" /></div>
            <div>
              <div className="text-xs text-gray-500">Estimasi MRR</div>
              <div className="text-xl font-bold text-gray-900">Rp {summary.estimatedMrr.toLocaleString('id-ID')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Kartu Plan */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {plans.map((plan) => (
          <Link
            key={plan.id}
            href={`/billing-management/${plan.code}`}
            className={`group flex flex-col rounded-2xl border-2 p-5 transition-all hover:shadow-md ${PLAN_COLORS[plan.code] || 'border-gray-200 bg-white hover:border-blue-300'}`}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">{plan.name}</h3>
                <p className="mt-0.5 text-xs text-gray-400">{plan.description || plan.code}</p>
              </div>
              <ChevronRight size={16} className="mt-1 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" />
            </div>

            <div className="mb-4">
              <span className="text-2xl font-bold text-gray-900">{rupiah(plan.priceMonthly)}</span>
              {plan.priceMonthly > 0 && <span className="text-xs text-gray-400">/bln</span>}
              {plan.priceYearly > 0 && (
                <div className="text-[11px] text-gray-400">atau Rp {plan.priceYearly.toLocaleString('id-ID')}/thn</div>
              )}
            </div>

            <div className="mb-4 space-y-1 text-xs text-gray-500">
              <div className="flex justify-between"><span>Users</span><span className="font-medium text-gray-700">{plan.maxUsers < 0 ? '\u221E' : plan.maxUsers}</span></div>
              <div className="flex justify-between"><span>Drivers</span><span className="font-medium text-gray-700">{plan.maxDrivers < 0 ? '\u221E' : plan.maxDrivers}</span></div>
              <div className="flex justify-between"><span>Shipments/bln</span><span className="font-medium text-gray-700">{plan.maxShipments < 0 ? '\u221E' : plan.maxShipments.toLocaleString('id-ID')}</span></div>
            </div>

            <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
              <div>
                <div className="text-lg font-bold text-gray-900">{plan.subscribers.toLocaleString('id-ID')}</div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">Tenant</div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                  <TrendingUp size={13} />Rp {plan.mrr.toLocaleString('id-ID')}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">MRR</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <p className="text-xs text-gray-400">
        Klik salah satu kartu paket untuk melihat daftar tenant yang berlangganan dan melakukan upgrade.
      </p>
    </div>
  );
}
