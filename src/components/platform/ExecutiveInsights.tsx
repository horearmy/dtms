"use client";

import { CheckCircle2, AlertTriangle, ShieldAlert, TrendingUp, Users } from 'lucide-react';

type Insight = { type: string; text: string };

const typeConfig: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  positive: { color: '#16B364', bg: '#F0FDF4', border: '#BBF7D0', icon: <CheckCircle2 size={16} /> },
  attention: { color: '#FF8A00', bg: '#FFFAEB', border: '#FEDF89', icon: <AlertTriangle size={16} /> },
  critical: { color: '#F5222D', bg: '#FEF3F2', border: '#FEE4E2', icon: <ShieldAlert size={16} /> },
  revenue: { color: '#7C3AED', bg: '#F5F3FF', border: '#E9D5FF', icon: <TrendingUp size={16} /> },
  opportunity: { color: '#0D6EFD', bg: '#EFF4FF', border: '#BFDBFE', icon: <Users size={16} /> },
};

export default function ExecutiveInsights({ insights }: { insights: Insight[] }) {
  if (!insights || insights.length === 0) return null;

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <h3 className="text-sm font-bold text-[#101828]">Executive Insights</h3>
      <div className="mt-3 space-y-2">
        {insights.map((insight, i) => {
          const cfg = typeConfig[insight.type] || typeConfig.positive;
          return (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border px-3 py-2.5"
              style={{ borderColor: cfg.border, backgroundColor: cfg.bg }}
            >
              <div className="mt-0.5 shrink-0" style={{ color: cfg.color }}>{cfg.icon}</div>
              <p className="text-sm text-[#101828]">{insight.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
