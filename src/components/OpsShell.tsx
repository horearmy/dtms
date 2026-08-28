'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

type WhiteLabel = { appName: string | null; logoUrl: string | null; primaryColor: string | null; secondaryColor: string | null; accentColor: string | null } | null;

export default function OpsShell({ name, role, tenantPlan, planFeatures, whiteLabel, children }: { name: string; role: string; tenantPlan: string | null; planFeatures?: string[]; whiteLabel?: WhiteLabel; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div
      className="min-h-screen bg-[#F7F9FC]"
      style={{
        '--brand-primary': whiteLabel?.primaryColor || '#0D6EFD',
        '--brand-secondary': whiteLabel?.secondaryColor || '#061B41',
        '--brand-accent': whiteLabel?.accentColor || '#13B8A6',
      } as React.CSSProperties}
    >
      <Sidebar name={name} role={role} tenantPlan={tenantPlan} planFeatures={planFeatures} whiteLabel={whiteLabel} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-[240px]">
        <Header name={name} role={role} whiteLabel={whiteLabel} onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
