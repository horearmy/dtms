"use client";

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Props = {
  label: string;
  value: string | number;
  changePct?: number;
  icon?: React.ReactNode;
  color?: string;
  subtitle?: string;
};

export default function KPICard({ label, value, changePct, icon, color = '#0D6EFD', subtitle }: Props) {
  const trendUp = changePct != null && changePct > 0;
  const trendDown = changePct != null && changePct < 0;
  const trendFlat = changePct != null && changePct === 0;

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#667085]">{label}</p>
          <p className="mt-1 text-2xl font-bold text-[#101828]">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-[#667085]">{subtitle}</p>}
        </div>
        {icon && (
          <div className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15` }}>
            <span style={{ color }}>{icon}</span>
          </div>
        )}
      </div>
      {changePct != null && (
        <div className="mt-2 flex items-center gap-1 text-xs font-semibold">
          {trendUp && <TrendingUp size={14} className="text-[#16B364]" />}
          {trendDown && <TrendingDown size={14} className="text-[#F5222D]" />}
          {trendFlat && <Minus size={14} className="text-[#667085]" />}
          <span className={trendUp ? 'text-[#16B364]' : trendDown ? 'text-[#F5222D]' : 'text-[#667085]'}>
            {trendUp && '+'}{changePct.toFixed(1)}%
          </span>
          <span className="text-[#667085] font-normal">vs periode lalu</span>
        </div>
      )}
    </div>
  );
}
