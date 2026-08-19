"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Pagination from '@/components/Pagination';
import { ROLE_LABELS, formatDateTime } from '@/lib/constants';
import { btnGhost } from '@/components/ui';

type UserInfo = {
  id: string; name: string; username: string; email: string | null;
  role: string; status: string; phone: string | null;
  mustChangePassword: boolean; lastPasswordChange: string | null;
  createdAt: string; totpEnabled: boolean; provider: string;
  driver: { id: string; employeeId: string; name: string } | null;
};

type AuditRow = {
  id: string; action: string; module: string; oldData: string | null;
  newData: string | null; ip: string | null; method: string | null;
  path: string | null; createdAt: string;
};

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  ADMIN_OPERASIONAL: 'bg-[#0D6EFD]/10 text-[#0D6EFD]',
  DISPATCHER: 'bg-cyan-100 text-cyan-700',
  WAREHOUSE: 'bg-indigo-100 text-indigo-700',
  CUSTOMER_SERVICE: 'bg-teal-100 text-teal-700',
  SUPERVISOR: 'bg-orange-100 text-orange-700',
  MANAGEMENT: 'bg-[#F7F9FC] text-[#667085]',
  DRIVER: 'bg-emerald-100 text-emerald-700',
  CUSTOMER: 'bg-rose-100 text-rose-700',
};

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    LOGIN_SUCCESS: 'bg-emerald-100 text-emerald-700',
    LOGIN_FAILED: 'bg-red-100 text-red-600',
    CREATE_USER: 'bg-blue-100 text-blue-700',
    UPDATE_USER: 'bg-amber-100 text-amber-700',
    DELETE_USER: 'bg-red-100 text-red-600',
    CHANGE_PASSWORD: 'bg-indigo-100 text-indigo-700',
    RESET_PASSWORD: 'bg-orange-100 text-orange-700',
    INVITE_USER: 'bg-blue-100 text-blue-700',
    BULK_IMPORT_USER: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors[action] || 'bg-[#F7F9FC] text-[#667085]'}`}>
      {action}
    </span>
  );
}

export default function UserActivityPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const [user, setUser] = useState<UserInfo | null>(null);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/users/${userId}/activity?page=${page}&pageSize=${pageSize}`);
    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
      setLogs(data.logs);
      setTotal(data.total);
    }
    setLoading(false);
  }, [userId, page]);
  useEffect(() => { load(); }, [load]);

  if (loading && !user) return <div className="p-8 text-center text-[#667085]">Memuat...</div>;
  if (!user) return <div className="p-8 text-center text-[#667085]">User tidak ditemukan</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className={btnGhost}>&larr;</button>
        <div>
          <h1 className="text-xl font-bold text-[#101828]">Aktivitas User</h1>
          <p className="text-sm text-[#667085]">Riwayat login dan aktivitas untuk {user.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <div className="text-xs font-semibold text-[#667085]">Username</div>
          <div className="mt-1 font-mono text-sm font-medium text-[#101828]">{user.username}</div>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <div className="text-xs font-semibold text-[#667085]">Role</div>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${ROLE_BADGE[user.role] || ''}`}>
            {ROLE_LABELS[user.role] || user.role}
          </span>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <div className="text-xs font-semibold text-[#667085]">Status</div>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${user.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-[#E4E7EC] text-[#667085]'}`}>
            {user.status}
          </span>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <div className="text-xs font-semibold text-[#667085]">2FA</div>
          <div className="mt-1 text-sm font-medium text-[#101828]">{user.totpEnabled ? 'Aktif' : 'Nonaktif'}</div>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <div className="text-xs font-semibold text-[#667085]">Telepon</div>
          <div className="mt-1 text-sm font-medium text-[#101828]">{user.phone || '-'}</div>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <div className="text-xs font-semibold text-[#667085]">Email</div>
          <div className="mt-1 text-sm font-medium text-[#101828]">{user.email || '-'}</div>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <div className="text-xs font-semibold text-[#667085]">Password Terakhir Diubah</div>
          <div className="mt-1 text-sm font-medium text-[#101828]">{formatDateTime(user.lastPasswordChange)}</div>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <div className="text-xs font-semibold text-[#667085]">Akun Dibuat</div>
          <div className="mt-1 text-sm font-medium text-[#101828]">{formatDateTime(user.createdAt)}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="border-b border-[#E4E7EC] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#101828]">Riwayat Aktivitas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F7F9FC] text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                <th className="px-4 py-3 text-left">Waktu</th>
                <th className="px-4 py-3 text-left">Aksi</th>
                <th className="px-4 py-3 text-left">Modul</th>
                <th className="px-4 py-3 text-left">Detail</th>
                <th className="px-4 py-3 text-left">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-[#667085]">{formatDateTime(log.createdAt)}</td>
                  <td className="px-4 py-3"><ActionBadge action={log.action} /></td>
                  <td className="px-4 py-3 text-xs text-[#667085]">{log.module}</td>
                  <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-[#667085]">
                    {log.newData || log.oldData || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[#667085]">{log.ip || '-'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[#667085]">Belum ada aktivitas</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
      </div>
    </div>
  );
}
