'use client';

import { useEffect, useState, useRef } from 'react';
import { Upload, Download, FileText, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

type ImportResult = {
  total: number;
  success: number;
  failed: number;
  errors: { row: number; message: string }[];
};

type Integration = {
  id: string;
  name: string;
  type: string;
  active: boolean;
  lastSyncAt: string | null;
};

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [importType, setImportType] = useState<'customer' | 'driver'>('customer');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchIntegrations(); }, []);

  async function fetchIntegrations() {
    try {
      const res = await fetch('/api/integrations');
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  const handleImport = async (file: File) => {
    setImporting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', importType);
      const res = await fetch('/api/integrations/import-export', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch { /* ignore */ }
    setImporting(false);
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/integrations/import-export?entity=shipment');
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shipments-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* ignore */ }
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Memuat...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Integration Hub</h1>

      {/* Active Integrations */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Aktif</h2>
        {integrations.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada integrasi aktif</p>
        ) : (
          <div className="space-y-2">
            {integrations.map((int) => (
              <div key={int.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${int.active ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{int.name}</div>
                    <div className="text-xs text-gray-400">{int.type}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  {int.lastSyncAt ? `Sync: ${new Date(int.lastSyncAt).toLocaleString('id-ID')}` : 'Belum sync'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CSV Import */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
          <Upload size={14} /> CSV Import
        </h2>
        <div className="flex items-center gap-3 mb-4">
          <select
            value={importType}
            onChange={(e) => setImportType(e.target.value as 'customer' | 'driver')}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="customer">Customers</option>
            <option value="driver">Drivers</option>
          </select>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {importing ? 'Mengimport...' : 'Pilih File CSV'}
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
            />
          </label>
        </div>
        <p className="text-xs text-gray-400">
          Format: {importType === 'customer' ? 'name, phone, email, address, city, postalCode' : 'name, employeeId, phone'}
        </p>

        {result && (
          <div className={`mt-4 rounded-lg p-4 ${result.failed > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              {result.failed > 0 ? <AlertTriangle size={16} className="text-amber-600" /> : <CheckCircle size={16} className="text-green-600" />}
              <span className="text-sm font-semibold">
                {result.success} berhasil, {result.failed} gagal dari {result.total} total
              </span>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto text-xs text-amber-700">
                {result.errors.map((e, i) => (
                  <div key={i}>Baris {e.row}: {e.message}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CSV Export */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
          <Download size={14} /> CSV Export
        </h2>
        <p className="mb-3 text-sm text-gray-600">Export data pengiriman ke CSV</p>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <FileText size={14} /> Download Shipments CSV
        </button>
      </div>
    </div>
  );
}
