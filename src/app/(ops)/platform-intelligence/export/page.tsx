'use client';

import { useState } from 'react';
import { Download, Package, Building2, Truck, Car, Users, AlertTriangle, CreditCard, Plug, FileText } from 'lucide-react';
import { useNotification } from '@/components/ui/NotificationContext';

type ExportItem = {
  type: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  endpoint: string;
};

const EXPORTS: ExportItem[] = [
  { type: 'shipments', label: 'Shipments', description: 'Data pengiriman lengkap dengan tracking, status, dan driver', icon: <Package size={20} />, color: '#0D6EFD', endpoint: '/api/platform/reports/export?type=shipments' },
  { type: 'tenants', label: 'Tenants', description: 'Data tenant termasuk status, plan, dan tanggal pembuatan', icon: <Building2 size={20} />, color: '#7C3AED', endpoint: '/api/platform/reports/export?type=tenants' },
  { type: 'drivers', label: 'Drivers', description: 'Data driver termasuk kontak dan status aktif', icon: <Truck size={20} />, color: '#16B364', endpoint: '/api/platform/reports/export?type=drivers' },
  { type: 'vehicles', label: 'Vehicles', description: 'Data kendaraan termasuk tipe, brand, dan status', icon: <Car size={20} />, color: '#FF8A00', endpoint: '/api/platform/reports/export?type=vehicles' },
  { type: 'customers', label: 'Customers', description: 'Data pelanggan termasuk kontak dan lokasi', icon: <Users size={20} />, color: '#0EA5E9', endpoint: '/api/platform/reports/export?type=customers' },
  { type: 'exceptions', label: 'Exceptions', description: 'Data exception termasuk tipe, severity, dan status', icon: <AlertTriangle size={20} />, color: '#F5222D', endpoint: '/api/platform/reports/export?type=exceptions' },
  { type: 'invoices', label: 'Invoices', description: 'Data invoice termasuk status pembayaran dan amount', icon: <CreditCard size={20} />, color: '#7C3AED', endpoint: '/api/platform/reports/export?type=invoices' },
  { type: 'integration_logs', label: 'Integration Logs', description: 'Log integrasi termasuk status, error, dan direction', icon: <Plug size={20} />, color: '#667085', endpoint: '/api/platform/reports/export?type=integration_logs' },
];

export default function ExportPage() {
  const { success, error: notifyError } = useNotification();
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleExport = async (item: ExportItem) => {
    setDownloading(item.type);
    try {
      const res = await fetch(item.endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `${item.type}_export.csv`;
      a.click(); URL.revokeObjectURL(url);
      success(`${item.label} berhasil diunduh`);
    } catch {
      notifyError('Gagal mengunduh file', 'Silakan coba lagi.');
    } finally { setDownloading(null); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 lg:p-6">
      <div>
        <h1 className="text-lg font-bold text-[#101828]">Export Data</h1>
        <p className="text-xs text-[#667085]">Ekspor data platform ke file CSV</p>
      </div>

      <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-xs text-[#667085]">
          <FileText size={14} />
          <span>Semua file diunduh dalam format <strong>CSV</strong>. Maksimal 5.000 baris per ekspor.</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {EXPORTS.map((item) => (
          <button
            key={item.type}
            onClick={() => handleExport(item)}
            disabled={downloading === item.type}
            className="group flex items-start gap-3 rounded-xl border border-[#E4E7EC] bg-white p-4 text-left transition hover:border-[#0D6EFD] hover:shadow-md disabled:opacity-50"
          >
            <div className="rounded-lg p-2" style={{ backgroundColor: `${item.color}15`, color: item.color }}>
              {item.icon}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-[#101828] group-hover:text-[#0D6EFD]">{item.label}</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-[#667085]">{item.description}</p>
            </div>
            <div className="mt-1">
              {downloading === item.type ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0D6EFD] border-t-transparent" />
              ) : (
                <Download size={16} className="text-[#D0D5DD] group-hover:text-[#0D6EFD]" />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
