import { prisma } from '@/lib/prisma';
import { formatDateTime } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { name: true, username: true } } },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-sm text-slate-500">Rekam jejak aktivitas pengguna ({logs.length} catatan terbaru)</p>
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
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(l.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-700">{l.user?.name || 'Sistem'}</td>
                  <td className="px-4 py-3"><span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">{l.action}</span></td>
                  <td className="px-4 py-3 text-slate-600">{l.module}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{l.newData || '-'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="py-10 text-center text-slate-400">Belum ada aktivitas tercatat</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}