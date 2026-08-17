'use client';

import { useEffect, useState, useCallback } from 'react';
import Pagination from '@/components/Pagination';
import { formatDateTime } from '@/lib/constants';

type AuditLog = {
  id: string;
  action: string;
  module: string;
  newData: string | null;
  createdAt: string;
  user: { name: string; username: string } | null;
};

export default function AuditPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/audit?page=${page}&pageSize=${pageSize}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-sm text-slate-500">Rekam jejak aktivitas pengguna ({total} catatan)</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Aksi</th>
                <th className="px-4 py-3">Modul</th>
                <th className="px-4 py-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400">Memuat...</td></tr>
              )}
              {!loading && items.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(l.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-700">{l.user?.name || 'Sistem'}</td>
                  <td className="px-4 py-3"><span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">{l.action}</span></td>
                  <td className="px-4 py-3 text-slate-600">{l.module}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{l.newData || '-'}</td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr><td colSpan={5} className="py-10 text-center text-slate-400">Belum ada aktivitas tercatat</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
      </div>
    </div>
  );
}
