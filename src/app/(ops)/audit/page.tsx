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
        <h1 className="text-xl font-bold text-[#101828]">Audit Log</h1>
        <p className="text-sm text-[#667085]">Rekam jejak aktivitas pengguna ({total} catatan)</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F7F9FC] text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                <th className="px-4 py-3 text-left">Waktu</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Aksi</th>
                <th className="px-4 py-3 text-left">Modul</th>
                <th className="px-4 py-3 text-left">Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="py-8 text-center text-[#667085]">Memuat...</td></tr>
              )}
              {!loading && items.map((l) => (
                <tr key={l.id} className="border-b border-[#E4E7EC] last:border-0">
                  <td className="px-4 py-3 text-xs text-[#667085]">{formatDateTime(l.createdAt)}</td>
                  <td className="px-4 py-3 text-[#101828]">{l.user?.name || 'Sistem'}</td>
                  <td className="px-4 py-3"><span className="rounded bg-[#F7F9FC] px-2 py-0.5 font-mono text-[11px] text-[#667085]">{l.action}</span></td>
                  <td className="px-4 py-3 text-[#667085]">{l.module}</td>
                  <td className="px-4 py-3 text-xs text-[#667085]">{l.newData || '-'}</td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr><td colSpan={5} className="py-10 text-center text-[#667085]">Belum ada aktivitas tercatat</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
      </div>
    </div>
  );
}
