"use client";

import { AlertTriangle, AlertCircle, Info, ShieldAlert } from 'lucide-react';

type Alert = { severity: string; title: string; description: string; count: number };

const severityConfig: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  CRITICAL: { color: '#F5222D', bg: '#FEF3F2', icon: <ShieldAlert size={16} />, label: 'CRITICAL' },
  HIGH: { color: '#FF8A00', bg: '#FFFAEB', icon: <AlertTriangle size={16} />, label: 'HIGH' },
  MEDIUM: { color: '#0D6EFD', bg: '#EFF4FF', icon: <AlertCircle size={16} />, label: 'MEDIUM' },
  INFO: { color: '#667085', bg: '#F7F9FC', icon: <Info size={16} />, label: 'INFO' },
};

export default function AlertCenter({ alerts }: { alerts: Alert[] }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h3 className="text-sm font-bold text-[#101828]">Alert Center</h3>
        <div className="mt-4 flex items-center justify-center py-8 text-sm text-[#667085]">
          Tidak ada alert aktif. Semua kondisi normal.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#101828]">Alert Center</h3>
        <span className="rounded-full bg-[#F5222D] px-2 py-0.5 text-[10px] font-bold text-white">
          {alerts.length} AKTIF
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {alerts.map((alert, i) => {
          const cfg = severityConfig[alert.severity] || severityConfig.INFO;
          return (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border px-3 py-2.5"
              style={{ borderColor: `${cfg.color}30`, backgroundColor: cfg.bg }}
            >
              <div className="mt-0.5 shrink-0" style={{ color: cfg.color }}>{cfg.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block rounded px-1.5 py-px text-[9px] font-bold uppercase text-white"
                    style={{ backgroundColor: cfg.color }}
                  >
                    {cfg.label}
                  </span>
                  <span className="text-sm font-semibold text-[#101828]">{alert.title}</span>
                </div>
                <p className="mt-0.5 text-xs text-[#667085]">{alert.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
