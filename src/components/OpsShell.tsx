'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default function OpsShell({ name, role, tenantPlan, children }: { name: string; role: string; tenantPlan: string | null; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <Sidebar role={role} tenantPlan={tenantPlan} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-[240px]">
        <Header name={name} role={role} onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
