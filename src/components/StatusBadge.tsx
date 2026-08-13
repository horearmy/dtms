import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants';

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}