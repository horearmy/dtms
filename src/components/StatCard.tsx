import { type ReactNode } from 'react';

export default function StatCard({
  label,
  value,
  sub,
  color = 'bg-white',
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon?: ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${color}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#667085]">{label}</span>
        {icon && <div className="text-[#667085]">{icon}</div>}
      </div>
      <div className="mt-2 text-2xl font-bold text-[#101828]">{value}</div>
      {sub && <div className="mt-1 text-xs text-[#667085]">{sub}</div>}
    </div>
  );
}
