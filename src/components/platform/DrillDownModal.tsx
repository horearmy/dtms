'use client';

import { X, Download } from 'lucide-react';

const LABEL_MAP: Record<string, string> = {
  name: 'Nama', status: 'Status', plan: 'Plan', users: 'Users', drivers: 'Drivers',
  shipments: 'Shipments', createdAt: 'Created', trackingNumber: 'Tracking No.',
  serviceType: 'Service', sender: 'Sender', origin: 'Origin', destination: 'Destination',
  driver: 'Driver', shipmentStatus: 'Status', detectedAt: 'Detected At',
  title: 'Title', type: 'Type', severity: 'Severity', dueAt: 'Due',
  tenantName: 'Tenant', invoiceCount: 'Invoices', totalBilled: 'Total Billed',
  totalPaid: 'Paid', outstanding: 'Outstanding',
};

export type DrillDownData = {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: any[];
  totalLabel?: string;
  totalValue?: string | number;
};

function formatCell(col: string, val: any): React.ReactNode {
  if (val == null || val === '') return '-';
  if (col === 'status' || col === 'shipmentStatus') {
    const colors: Record<string, string> = {
      ACTIVE: '#16B364', SUSPENDED: '#F5222D', TRIAL: '#0D6EFD',
      ON_TRACK: '#16B364', BREACHED: '#F5222D', AT_RISK: '#FF8A00',
      OPEN: '#F5222D', ASSIGNED: '#FF8A00', INVESTIGATING: '#0D6EFD',
      ACTION_REQUIRED: '#7C3AED', RESOLVED: '#16B364', VERIFIED: '#16B364',
      CLOSED: '#667085', CANCELLED: '#667085',
    };
    const bg = colors[val] || '#667085';
    return <span className="inline-block rounded px-1.5 py-px text-[9px] font-bold uppercase text-white" style={{ backgroundColor: bg }}>{val.replace(/_/g, ' ')}</span>;
  }
  if (col === 'severity') {
    const colors: Record<string, string> = { CRITICAL: '#F5222D', HIGH: '#FF8A00', MEDIUM: '#0D6EFD', LOW: '#667085' };
    return <span className="inline-block rounded px-1.5 py-px text-[9px] font-bold uppercase text-white" style={{ backgroundColor: colors[val] || '#667085' }}>{val}</span>;
  }
  if (col === 'plan') return <span className="font-semibold">{val}</span>;
  if (col === 'totalBilled' || col === 'totalPaid') return <span className={col === 'totalPaid' ? 'text-[#16B364]' : ''}>Rp {(val / 1_000_000).toFixed(1)}M</span>;
  if (col === 'outstanding') return <span className={val > 0 ? 'font-bold text-[#F5222D]' : 'text-[#667085]'}>Rp {(val / 1_000_000).toFixed(1)}M</span>;
  if (col === 'createdAt' || col === 'detectedAt' || col === 'dueAt') return new Date(val).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  return String(val);
}

export default function DrillDownModal({ data, onClose }: { data: DrillDownData | null; onClose: () => void }) {
  if (!data) return null;

  const rightAlignCols = new Set(['users', 'drivers', 'shipments', 'invoiceCount', 'totalBilled', 'totalPaid', 'outstanding']);

  const handleExportCSV = () => {
    const headers = data.columns.map((c) => LABEL_MAP[c] || c);
    const csvRows = data.rows.map((row) =>
      data.columns.map((c) => {
        const val = row[c];
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val ?? '';
      }).join(',')
    );
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title.replace(/\s+/g, '_').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalStr = typeof data.totalValue === 'number'
    ? data.totalValue.toLocaleString('id-ID')
    : typeof data.totalValue === 'string' && !isNaN(Number(data.totalValue))
      ? Number(data.totalValue).toLocaleString('id-ID')
      : data.totalValue;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="mx-4 max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E4E7EC] px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-[#101828]">{data.title}</h2>
            {data.subtitle && <p className="mt-0.5 text-xs text-[#667085]">{data.subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportCSV}
              className="flex items-center gap-1 rounded-lg border border-[#E4E7EC] px-2.5 py-1.5 text-[11px] font-semibold text-[#667085] hover:bg-[#F7F9FC]">
              <Download size={12} /> Export CSV
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-[#667085] hover:bg-[#F7F9FC]">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-auto" style={{ maxHeight: 'calc(85vh - 120px)' }}>
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#F7F9FC]">
              <tr className="border-b border-[#E4E7EC]">
                {data.columns.map((col) => (
                  <th key={col} className={`px-4 py-2.5 font-semibold text-[#667085] ${rightAlignCols.has(col) ? 'text-right' : ''}`}>
                    {LABEL_MAP[col] || col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr><td colSpan={data.columns.length} className="px-4 py-12 text-center text-[#667085]">Tidak ada data</td></tr>
              ) : (
                data.rows.map((row, i) => (
                  <tr key={i} className="border-b border-[#F7F9FC] hover:bg-[#F7F9FC]/50">
                    {data.columns.map((col) => (
                      <td key={col} className={`px-4 py-2.5 ${rightAlignCols.has(col) ? 'text-right' : ''}`}>
                        {formatCell(col, row[col])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data.totalLabel && (
          <div className="border-t border-[#E4E7EC] px-5 py-3 text-right text-xs">
            <span className="font-semibold text-[#667085]">{data.totalLabel}: </span>
            <span className="font-bold text-[#101828]">{totalStr}</span>
          </div>
        )}
      </div>
    </div>
  );
}
