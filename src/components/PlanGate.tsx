'use client';

import { useRouter } from 'next/navigation';
import { Lock, ArrowRight } from 'lucide-react';

const FEATURE_LABELS: Record<string, string> = {
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

export default function PlanGate({
  feature,
  children,
  planFeatures = [],
}: {
  feature: string;
  children: React.ReactNode;
  planFeatures?: string[];
}) {
  const router = useRouter();

  if (planFeatures.includes(feature)) {
    return <>{children}</>;
  }

  const featureName = FEATURE_LABELS[feature] || feature;

  return (
    <div className="relative">
      <div className="pointer-events-none blur-[2px] opacity-40">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-2xl border border-gray-200 bg-white/95 p-8 text-center shadow-xl backdrop-blur-sm max-w-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
            <Lock size={24} className="text-blue-600" />
          </div>
          <h3 className="mb-2 text-lg font-bold text-gray-900">Fitur Premium</h3>
          <p className="mb-1 text-sm font-medium text-gray-700">{featureName}</p>
          <p className="mb-5 text-sm text-gray-500">
            Upgrade plan Anda untuk mengakses fitur ini
          </p>
          <button
            onClick={() => router.push(`/billing?upgrade=${feature}`)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Lihat Plan
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
