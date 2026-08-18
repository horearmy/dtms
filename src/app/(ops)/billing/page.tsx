'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Clock, CreditCard, Zap, Building2, Globe } from 'lucide-react';

type Plan = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  maxUsers: number;
  maxDrivers: number;
  maxShipments: number;
  features: string[] | null;
};

type Subscription = {
  id: string;
  status: string;
  billingCycle: string;
  currentPeriodEnd: string;
  plan: Plan;
};

type Usage = {
  users: number;
  drivers: number;
  shipments: number;
};

const FEATURES: Record<string, string> = {
  basic_tracking: 'Basic Tracking',
  dispatch: 'Dispatch Board',
  reports: 'Laporan & Export',
  sla: 'SLA Management',
  eta: 'ETA Engine',
  control_tower: 'Control Tower',
  api: 'API Access',
  webhooks: 'Webhooks',
  integrations: 'Integrations',
  priority_support: 'Priority Support',
};

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const res = await fetch('/api/billing');
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
        setSubscription(data.subscription);
        setUsage(data.usage?.usage || null);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  const handleSubscribe = async (planCode: string) => {
    setSubscribing(planCode);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode, billingCycle }),
      });
      if (res.ok) fetchData();
    } catch { /* ignore */ }
    setSubscribing(null);
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Memuat...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription & Billing</h1>
          <p className="text-sm text-gray-500">Kelola langganan dan pembayaran</p>
        </div>
        {subscription && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-right">
            <div className="text-xs text-gray-500">Current Plan</div>
            <div className="text-lg font-bold text-blue-600">{subscription.plan.name}</div>
            <div className="text-xs text-gray-400">
              {subscription.status === 'ACTIVE' ? 'Aktif' : subscription.status} · {subscription.billingCycle === 'MONTHLY' ? 'Bulanan' : 'Tahunan'}
            </div>
          </div>
        )}
      </div>

      {/* Usage */}
      {usage && subscription && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Penggunaan Bulan Ini</h2>
          <div className="grid grid-cols-3 gap-4">
            <UsageBar label="Users" used={usage.users} max={subscription.plan.maxUsers} />
            <UsageBar label="Drivers" used={usage.drivers} max={subscription.plan.maxDrivers} />
            <UsageBar label="Shipments" used={usage.shipments} max={subscription.plan.maxShipments} />
          </div>
        </div>
      )}

      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setBillingCycle('MONTHLY')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${billingCycle === 'MONTHLY' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Bulanan
        </button>
        <button
          onClick={() => setBillingCycle('YEARLY')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${billingCycle === 'YEARLY' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Tahunal <span className="ml-1 text-xs text-green-400">Hemat 17%</span>
        </button>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const price = billingCycle === 'MONTHLY' ? plan.priceMonthly : plan.priceYearly;
          const isCurrent = subscription?.plan.code === plan.code;
          const features = (plan.features as string[]) || [];

          return (
            <div key={plan.id} className={`relative rounded-2xl border-2 p-6 transition-all ${
              isCurrent ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'
            }`}>
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">
                  Current Plan
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {price === 0 ? 'Gratis' : `Rp ${price.toLocaleString('id-ID')}`}
                  </span>
                  {price > 0 && <span className="text-sm text-gray-500">/{billingCycle === 'MONTHLY' ? 'bln' : 'thn'}</span>}
                </div>
              </div>

              <div className="mb-4 space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-500" />
                  <span>{plan.maxUsers < 0 ? 'Unlimited' : plan.maxUsers} Users</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-500" />
                  <span>{plan.maxDrivers < 0 ? 'Unlimited' : plan.maxDrivers} Drivers</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-500" />
                  <span>{plan.maxShipments < 0 ? 'Unlimited' : plan.maxShipments} Shipments/bulan</span>
                </div>
              </div>

              <div className="mb-4 space-y-1">
                {features.map((f) => (
                  <div key={f} className="flex items-center gap-1 text-xs text-gray-500">
                    <CheckCircle size={10} className="text-green-400" /> {FEATURES[f] || f}
                  </div>
                ))}
              </div>

              {!isCurrent && (
                <button
                  onClick={() => handleSubscribe(plan.code)}
                  disabled={subscribing === plan.code}
                  className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {subscribing === plan.code ? 'Memproses...' : price === 0 ? 'Aktifkan' : 'Pilih Plan'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UsageBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max < 0 ? 10 : Math.min(100, (used / max) * 100);
  const isWarning = pct > 80;
  const isUnlimited = max < 0;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className={`text-xs ${isWarning ? 'text-red-500' : 'text-gray-400'}`}>
          {used} / {isUnlimited ? '∞' : max}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 rounded-full bg-gray-100">
          <div className={`h-2 rounded-full transition-all ${isWarning ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
