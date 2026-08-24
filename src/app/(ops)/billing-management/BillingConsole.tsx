'use client';

import { useState } from 'react';
import { FileText, Handshake, LayoutDashboard, Layers, PlayCircle } from 'lucide-react';
import BillingOverview from './BillingOverview';
import DashboardTab from './DashboardTab';
import InvoicesTab from './InvoicesTab';
import ContractsTab from './ContractsTab';
import RunsTab from './RunsTab';

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan', icon: LayoutDashboard },
  { key: 'plan', label: 'Plan & Pelanggan', icon: Layers },
  { key: 'invoice', label: 'Invoice', icon: FileText },
  { key: 'kontrak', label: 'Kontrak', icon: Handshake },
  { key: 'runs', label: 'Billing Runs', icon: PlayCircle },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function BillingConsole() {
  const [tab, setTab] = useState<TabKey>('ringkasan');

  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-1.5 rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-[#101828] text-white shadow'
                : 'text-[#667085] hover:bg-gray-100 hover:text-[#101828]'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>

      <div>
        {tab === 'ringkasan' && <DashboardTab />}
        {tab === 'plan' && <BillingOverview />}
        {tab === 'invoice' && <InvoicesTab />}
        {tab === 'kontrak' && <ContractsTab />}
        {tab === 'runs' && <RunsTab />}
      </div>
    </div>
  );
}
