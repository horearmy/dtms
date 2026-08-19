'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Zap, Lock, X, ArrowRight, FileText } from 'lucide-react';

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
  currentPeriodStart: string;
  currentPeriodEnd: string;
  plan: Plan;
  invoices?: Invoice[];
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  dueDate: string;
  paidAt: string | null;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  createdAt: string;
};

type Usage = {
  users: number;
  drivers: number;
  shipments: number;
};

function parseFeatures(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val as string[];
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
  return [];
}

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

const ALL_FEATURES = Object.keys(FEATURES);

const PLAN_ORDER = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="text-center py-8 text-gray-500">Memuat...</div>}>
      <BillingPageInner />
    </Suspense>
  );
}

function BillingPageInner() {
  const searchParams = useSearchParams();
  const upgradeFeature = searchParams.get('upgrade');

  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<Plan | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeTab, setActiveTab] = useState<'plans' | 'invoices'>('plans');
  const [cancelling, setCancelling] = useState(false);
  const [cancellingConfirm, setCancellingConfirm] = useState(false);

  const currentPlanCode = subscription?.plan?.code || 'FREE';

  const fetchData = useCallback(async () => {
    try {
      const [billingRes, invoicesRes] = await Promise.all([
        fetch('/api/billing'),
        fetch('/api/billing/invoices'),
      ]);
      if (billingRes.ok) {
        const data = await billingRes.json();
        setPlans(data.plans || []);
        setSubscription(data.subscription);
        setUsage(data.usage?.usage || null);
      }
      if (invoicesRes.ok) {
        const data = await invoicesRes.json();
        setInvoices(data.invoices || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-scroll to suggested plan if ?upgrade=feature is present
  useEffect(() => {
    if (upgradeFeature && plans.length > 0) {
      const suggestedPlan = plans.find(p => {
        const features = parseFeatures(p.features);
        return features.includes(upgradeFeature) && p.code !== currentPlanCode;
      });
      if (suggestedPlan) {
        setTimeout(() => {
          document.getElementById(`plan-${suggestedPlan.code}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    }
  }, [upgradeFeature, plans, currentPlanCode]);

  const handleSubscribe = async (planCode: string) => {
    setSubscribing(planCode);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode, billingCycle }),
      });
      if (res.ok) {
        setConfirmPlan(null);
        fetchData();
      }
    } catch { /* ignore */ }
    setSubscribing(null);
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' });
      if (res.ok) {
        setCancellingConfirm(false);
        fetchData();
      }
    } catch { /* ignore */ }
    setCancelling(false);
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Memuat...</div>;

  const currentPlanIndex = subscription ? PLAN_ORDER.indexOf(subscription.plan.code) : 0;
  const currentPlanName = subscription?.plan?.name || 'Free';
  const isOnFree = currentPlanCode === 'FREE';

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Upgrade Banner */}
      {upgradeFeature && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
          <Lock size={20} className="text-amber-600 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-amber-800">Fitur Premium: {FEATURES[upgradeFeature] || upgradeFeature}</div>
            <div className="text-xs text-amber-600">Pilih plan di bawah untuk mengakses fitur ini</div>
          </div>
        </div>
      )}

      {/* Free Plan CTA */}
      {isOnFree && !upgradeFeature && (
        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Kurang fitur?</h2>
              <p className="text-sm text-gray-500 mt-1">Upgrade ke plan berbayar untuk akses fitur lengkap: SLA, Control Tower, API, dan lainnya.</p>
            </div>
            <button
              onClick={() => document.getElementById('plan-STARTER')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="shrink-0 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
            >
              Lihat Plan
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription & Billing</h1>
          <p className="text-sm text-gray-500">Kelola langganan dan pembayaran</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-right">
          <div className="text-xs text-gray-500">Plan Saat Ini</div>
          <div className="text-lg font-bold text-blue-600">{currentPlanName}</div>
          <div className="text-xs text-gray-400">
            {subscription
              ? `${subscription.status === 'ACTIVE' ? 'Aktif' : subscription.status} · ${subscription.billingCycle === 'MONTHLY' ? 'Bulanan' : 'Tahunan'}`
              : 'Free Tier'
            }
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        <button
          onClick={() => setActiveTab('plans')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${activeTab === 'plans' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center gap-2">
            <Zap size={14} />
            Plan & Harga
          </div>
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${activeTab === 'invoices' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center gap-2">
            <FileText size={14} />
            Invoice ({invoices.length})
          </div>
        </button>
      </div>

      {activeTab === 'plans' && (
        <>
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
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${billingCycle === 'MONTHLY' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Bulanan
            </button>
            <button
              onClick={() => setBillingCycle('YEARLY')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${billingCycle === 'YEARLY' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Tahunan <span className="ml-1 text-xs text-green-400">Hemat 17%</span>
            </button>
          </div>

          {/* Plans */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => {
              const price = billingCycle === 'MONTHLY' ? plan.priceMonthly : plan.priceYearly;
              const isCurrent = currentPlanCode === plan.code;
              const isDowngrade = PLAN_ORDER.indexOf(plan.code) < currentPlanIndex;
              const isUpgrade = PLAN_ORDER.indexOf(plan.code) > currentPlanIndex;
              const features = parseFeatures(plan.features);
              const hasUpgradeFeature = upgradeFeature && features.includes(upgradeFeature);

              return (
                <div key={plan.id} id={`plan-${plan.code}`} className={`relative rounded-2xl border-2 p-6 transition-all ${
                  isCurrent ? 'border-blue-600 bg-blue-50' :
                  hasUpgradeFeature ? 'border-amber-400 bg-amber-50' :
                  'border-gray-200 bg-white hover:border-blue-300'
                }`}>
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">
                      Current Plan
                    </div>
                  )}
                  {hasUpgradeFeature && !isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-0.5 text-xs font-semibold text-white">
                      Recommended
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
                      onClick={() => isDowngrade ? handleSubscribe(plan.code) : setConfirmPlan(plan)}
                      disabled={subscribing === plan.code}
                      className={`w-full rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                        isDowngrade
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {subscribing === plan.code ? 'Memproses...' :
                       isDowngrade ? 'Downgrade' :
                       price === 0 ? 'Aktifkan' : 'Upgrade'}
                    </button>
                  )}
                  {isCurrent && (
                    <div className="w-full rounded-lg bg-blue-100 py-2.5 text-center text-sm font-semibold text-blue-700">
                      Plan Aktif
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Cancel Subscription */}
          {!isOnFree && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">Batalkan Langganan</h2>
              <p className="mb-4 text-sm text-gray-500">
                Membatalkan langganan akan mengembalikan plan ke Free. Fitur premium akan dinonaktifkan.
              </p>
              {!cancellingConfirm ? (
                <button
                  onClick={() => setCancellingConfirm(true)}
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition"
                >
                  Batalkan Langganan
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-red-600 font-medium">Yakin ingin membatalkan?</span>
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {cancelling ? 'Membatalkan...' : 'Ya, Batalkan'}
                  </button>
                  <button
                    onClick={() => setCancellingConfirm(false)}
                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200"
                  >
                    Tidak
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Feature Comparison */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 overflow-x-auto">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Perbandingan Fitur</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-2 text-left font-medium text-gray-500">Fitur</th>
                  {plans.map(p => (
                    <th key={p.code} className={`py-2 text-center font-medium ${p.code === currentPlanCode ? 'text-blue-600' : 'text-gray-500'}`}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_FEATURES.map(f => (
                  <tr key={f} className="border-b border-gray-50">
                    <td className="py-2 text-gray-700">{FEATURES[f]}</td>
                    {plans.map(p => {
                      const features = parseFeatures(p.features);
                      const has = features.includes(f);
                      return (
                        <td key={p.code} className="py-2 text-center">
                          {has ? (
                            <CheckCircle size={16} className="mx-auto text-green-500" />
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'invoices' && (
        <div className="rounded-xl border border-gray-200 bg-white">
          {invoices.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <FileText size={32} className="mx-auto mb-2 text-gray-300" />
              <p>Belum ada invoice</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <div className="font-mono text-sm font-semibold text-gray-900">{inv.invoiceNumber}</div>
                    <div className="mt-0.5 text-xs text-gray-400">
                      {new Date(inv.billingPeriodStart).toLocaleDateString('id-ID')} — {new Date(inv.billingPeriodEnd).toLocaleDateString('id-ID')}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <InvoiceStatusBadge status={inv.status} />
                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-900">Rp {inv.total.toLocaleString('id-ID')}</div>
                      {inv.paidAt && (
                        <div className="text-xs text-green-600">Dibayar {new Date(inv.paidAt).toLocaleDateString('id-ID')}</div>
                      )}
                      {inv.status !== 'PAID' && (
                        <div className="text-xs text-gray-400">Jatuh tempo {new Date(inv.dueDate).toLocaleDateString('id-ID')}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Konfirmasi Upgrade</h3>
              <button onClick={() => setConfirmPlan(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="rounded-xl bg-gray-50 p-4 mb-4">
              <div className="text-sm text-gray-500">Upgrade dari</div>
              <div className="font-semibold text-gray-900">{currentPlanName}</div>
              <div className="my-2 flex justify-center">
                <ArrowRight size={16} className="text-blue-500" />
              </div>
              <div className="text-sm text-gray-500">Upgrade ke</div>
              <div className="font-semibold text-blue-600">{confirmPlan.name}</div>
            </div>

            <div className="rounded-xl bg-blue-50 p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Harga {billingCycle === 'MONTHLY' ? 'Bulanan' : 'Tahunan'}</span>
                <span className="text-lg font-bold text-blue-600">
                  Rp {(billingCycle === 'MONTHLY' ? confirmPlan.priceMonthly : confirmPlan.priceYearly).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>PPN 11%</span>
                <span>Rp {Math.round((billingCycle === 'MONTHLY' ? confirmPlan.priceMonthly : confirmPlan.priceYearly) * 0.11).toLocaleString('id-ID')}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-blue-100 pt-2">
                <span className="text-sm font-semibold text-gray-900">Total</span>
                <span className="text-lg font-bold text-gray-900">
                  Rp {Math.round((billingCycle === 'MONTHLY' ? confirmPlan.priceMonthly : confirmPlan.priceYearly) * 1.11).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-4 text-center">
              Invoice akan dibuat otomatis. Pembayaran dilakukan secara manual.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setConfirmPlan(null)}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Batal
              </button>
              <button
                onClick={() => handleSubscribe(confirmPlan.code)}
                disabled={subscribing === confirmPlan.code}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {subscribing === confirmPlan.code ? 'Memproses...' : 'Konfirmasi Upgrade'}
              </button>
            </div>
          </div>
        </div>
      )}
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

function InvoiceStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-gray-50 text-gray-600',
    SENT: 'bg-blue-50 text-blue-600',
    PAID: 'bg-green-50 text-green-600',
    OVERDUE: 'bg-red-50 text-red-600',
    CANCELLED: 'bg-gray-50 text-gray-400',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-50 text-gray-600'}`}>
      {status}
    </span>
  );
}
