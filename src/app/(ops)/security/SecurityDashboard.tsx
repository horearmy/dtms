'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Key, Lock, Unlock, UserX, RefreshCw } from 'lucide-react';

type ThreatBreakdown = {
  failedLogins: { value: number; weight: number; pct: number };
  lockedUsers: { value: number; weight: number; pct: number };
  lockedIPs: { value: number; weight: number; pct: number };
  twoFA: { value: number; total: number; weight: number; pct: number };
  mustChangePassword: { value: number; weight: number; pct: number };
};

type SecurityData = {
  threatScore: number;
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  threatBreakdown: ThreatBreakdown;
  summary: {
    failedLogins24h: number;
    successfulLogins24h: number;
    lockedOutUsers: number;
    lockedOutIPs: number;
    users2faDisabled: number;
    usersMustChangePassword: number;
    activeApiKeys: number;
    pendingResets: number;
    totalUsers: number;
    totalApiKeys: number;
  };
  loginActivity: {
    byHour: { hour: string; failed: number; success: number }[];
    topAttackingIPs: { ip: string; count: number }[];
    topTargetedUsers: { username: string; count: number }[];
  };
  recentSecurityEvents: {
    id: string;
    createdAt: string;
    userName: string;
    action: string;
    module: string;
    ip: string | null;
    path: string | null;
    detail: string | null;
  }[];
  userPosture: {
    tenantId: string;
    tenantName: string;
    totalUsers: number;
    users2faEnabled: number;
    usersMustChangePassword: number;
    usersOldPassword: number;
  }[];
};

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'Login Berhasil', LOGIN_FAILED: 'Login Gagal',
  TWO_FACTOR_LOGIN_SUCCESS: '2FA Berhasil', TWO_FACTOR_LOGIN_FAILED: '2FA Gagal',
  TWO_FACTOR_ENABLED: '2FA Diaktifkan', TWO_FACTOR_DISABLED: '2FA Dinonaktifkan',
  CHANGE_PASSWORD: 'Ganti Password', RESET_PASSWORD: 'Reset Password',
  RESET_PASSWORD_SELF: 'Reset Password (Self)',
  CREATE_USER: 'Buat User', DELETE_USER: 'Hapus User',
  DELETE_TENANT: 'Hapus Tenant', ARCHIVE_TENANT: 'Arsipkan Tenant',
  TENANT_THROTTLE_UPDATE: 'Update Rate Limit',
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN_SUCCESS: 'bg-emerald-100 text-emerald-700',
  LOGIN_FAILED: 'bg-red-100 text-red-700',
  TWO_FACTOR_LOGIN_SUCCESS: 'bg-emerald-100 text-emerald-700',
  TWO_FACTOR_LOGIN_FAILED: 'bg-red-100 text-red-700',
  TWO_FACTOR_ENABLED: 'bg-blue-100 text-blue-700',
  TWO_FACTOR_DISABLED: 'bg-amber-100 text-amber-700',
  CHANGE_PASSWORD: 'bg-blue-100 text-blue-700',
  RESET_PASSWORD: 'bg-amber-100 text-amber-700',
  DELETE_USER: 'bg-red-100 text-red-700',
  DELETE_TENANT: 'bg-red-100 text-red-700',
};

export default function SecurityDashboard() {
  const [data, setData] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/security');
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  const filteredEvents = data?.recentSecurityEvents.filter(
    (e) => !filter || e.action.includes(filter) || e.userName.toLowerCase().includes(filter.toLowerCase()) || e.ip?.includes(filter)
  ) || [];

  const maxBar = data ? Math.max(1, ...data.loginActivity.byHour.map((h) => h.failed + h.success)) : 1;

  if (loading) return <div className="py-12 text-center text-sm text-[#667085]">Memuat security dashboard...</div>;
  if (!data) return <div className="py-12 text-center text-sm text-red-600">Gagal memuat data</div>;

  const s = data.summary;
  const ts = data.threatScore;
  const tl = data.threatLevel;
  const bd = data.threatBreakdown;

  const threatCardStyle = tl === 'HIGH'
    ? 'text-red-600 bg-red-50 border-red-200'
    : tl === 'MEDIUM'
      ? 'text-amber-600 bg-amber-50 border-amber-200'
      : 'text-emerald-600 bg-emerald-50 border-emerald-200';
  const threatLabel = tl === 'HIGH' ? 'Tinggi' : tl === 'MEDIUM' ? 'Sedang' : 'Aman';
  const threatBarColor = tl === 'HIGH' ? 'bg-red-500' : tl === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#101828]">Security Dashboard</h1>
          <p className="mt-1 text-sm text-[#667085]">Monitoring keamanan sistem secara real-time.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[#667085]">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-4 w-4 rounded border-[#E4E7EC] text-[#0D6EFD] focus:ring-[#0D6EFD]" />
            Auto-refresh
          </label>
          <button onClick={load} className="rounded-lg border border-[#E4E7EC] p-2 text-[#667085] hover:bg-[#F7F9FC]">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Threat Score Card */}
      <div className={`rounded-xl border p-6 ${threatCardStyle}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider">Threat Level</div>
            <div className="mt-1 text-5xl font-bold">{ts}</div>
            <div className="mt-1 text-sm font-medium">{threatLabel}</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-xs leading-relaxed">
              <div className="font-semibold uppercase tracking-wider opacity-60">Bobot</div>
              <div>Login gagal: {bd.failedLogins.weight}%</div>
              <div>User terkunci: {bd.lockedUsers.weight}%</div>
              <div>IP terkunci: {bd.lockedIPs.weight}%</div>
              <div>2FA eligible: {bd.twoFA.weight}%</div>
              <div>Ganti password: {bd.mustChangePassword.weight}%</div>
            </div>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/50">
          <div className={`h-full rounded-full transition-all duration-700 ${threatBarColor}`} style={{ width: `${ts}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2 text-[11px]">
          <BreakdownPill label="Login gagal" value={bd.failedLogins.value} pct={bd.failedLogins.pct} color="red" />
          <BreakdownPill label="User locked" value={bd.lockedUsers.value} pct={bd.lockedUsers.pct} color="amber" />
          <BreakdownPill label="IP locked" value={bd.lockedIPs.value} pct={bd.lockedIPs.pct} color="amber" />
          <BreakdownPill label="2FA off" value={bd.twoFA.value} sub={`/ ${bd.twoFA.total}`} pct={bd.twoFA.pct} color="blue" />
          <BreakdownPill label="Ubah password" value={bd.mustChangePassword.value} pct={bd.mustChangePassword.pct} color="orange" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<ShieldAlert size={20} />} label="Login Gagal (24h)" value={s.failedLogins24h} color="text-red-600 bg-red-50" />
        <StatCard icon={<ShieldCheck size={20} />} label="Login Berhasil (24h)" value={s.successfulLogins24h} color="text-emerald-600 bg-emerald-50" />
        <StatCard icon={<Lock size={20} />} label="User Terkunci" value={s.lockedOutUsers} color="text-amber-600 bg-amber-50" />
        <StatCard icon={<Unlock size={20} />} label="IP Terkunci" value={s.lockedOutIPs} color="text-amber-600 bg-amber-50" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Shield size={20} />} label="2FA Disabled (Eligible)" value={`${s.users2faDisabled}`} color="text-blue-600 bg-blue-50" />
        <StatCard icon={<Key size={20} />} label="API Keys Aktif" value={`${s.activeApiKeys} / ${s.totalApiKeys}`} color="text-purple-600 bg-purple-50" />
        <StatCard icon={<UserX size={20} />} label="Must Change Password" value={s.usersMustChangePassword} color="text-amber-600 bg-amber-50" />
        <StatCard icon={<Lock size={20} />} label="Reset Token Pending" value={s.pendingResets} color="text-gray-600 bg-gray-50" />
      </div>

      {/* Login Activity Bar Chart */}
      <div className="rounded-xl border border-[#E4E7EC] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h2 className="mb-4 text-sm font-semibold text-[#101828]">Login Activity (1 jam terakhir)</h2>
        {data.loginActivity.byHour.length === 0 ? (
          <div className="py-4 text-center text-sm text-[#667085]">Tidak ada data login</div>
        ) : (
          <div className="flex items-end gap-1" style={{ height: 120 }}>
            {data.loginActivity.byHour.map((h) => (
              <div key={h.hour} className="flex flex-1 flex-col items-center gap-0.5" title={`${new Date(h.hour).toLocaleTimeString('id-ID')}: ${h.success} ok / ${h.failed} gagal`}>
                <div className="flex w-full flex-col items-center">
                  {h.failed > 0 && <div className="w-full rounded-t bg-red-400" style={{ height: `${(h.failed / maxBar) * 100}%`, minHeight: h.failed > 0 ? 2 : 0 }} />}
                  {h.success > 0 && <div className="w-full rounded-t bg-emerald-400" style={{ height: `${(h.success / maxBar) * 100}%`, minHeight: h.success > 0 ? 2 : 0 }} />}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center gap-4 text-xs text-[#667085]">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> Berhasil</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-400" /> Gagal</span>
        </div>
      </div>

      {/* Top Attacking IPs + Targeted Users */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="mb-4 text-sm font-semibold text-[#101828]">Top Attacking IPs (24h)</h2>
          {data.loginActivity.topAttackingIPs.length === 0 ? (
            <div className="py-4 text-center text-sm text-[#667085]">Tidak ada percobaan gagal</div>
          ) : (
            <table className="w-full text-left text-sm">
              <tbody>
                {data.loginActivity.topAttackingIPs.map((ip) => (
                  <tr key={ip.ip} className="border-b border-[#E4E7EC] last:border-0">
                    <td className="py-2 font-mono text-xs text-[#101828]">{ip.ip}</td>
                    <td className="py-2 text-right"><span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{ip.count}x</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="mb-4 text-sm font-semibold text-[#101828]">Top Targeted Users (24h)</h2>
          {data.loginActivity.topTargetedUsers.length === 0 ? (
            <div className="py-4 text-center text-sm text-[#667085]">Tidak ada percobaan gagal</div>
          ) : (
            <table className="w-full text-left text-sm">
              <tbody>
                {data.loginActivity.topTargetedUsers.map((u) => (
                  <tr key={u.username} className="border-b border-[#E4E7EC] last:border-0">
                    <td className="py-2 text-[#101828]">@{u.username}</td>
                    <td className="py-2 text-right"><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{u.count}x</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* User Security Posture */}
      <div className="rounded-xl border border-[#E4E7EC] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h2 className="mb-4 text-sm font-semibold text-[#101828]">User Security Posture per Tenant</h2>
        {data.userPosture.length === 0 ? (
          <div className="py-4 text-center text-sm text-[#667085]">Tidak ada data</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-[#F7F9FC] text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3 text-center">Total Users</th>
                  <th className="px-4 py-3 text-center">2FA Aktif</th>
                  <th className="px-4 py-3 text-center">Must Change PW</th>
                  <th className="px-4 py-3 text-center">Password Lama</th>
                  <th className="px-4 py-3">2FA Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.userPosture.map((t) => {
                  const fa2Rate = t.totalUsers > 0 ? Math.round((t.users2faEnabled / t.totalUsers) * 100) : 0;
                  return (
                    <tr key={t.tenantId} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                      <td className="px-4 py-3 font-medium text-[#101828]">{t.tenantName}</td>
                      <td className="px-4 py-3 text-center text-[#667085]">{t.totalUsers}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.users2faEnabled > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                          {t.users2faEnabled}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {t.usersMustChangePassword > 0 ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{t.usersMustChangePassword}</span>
                        ) : <span className="text-xs text-[#667085]">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {t.usersOldPassword > 0 ? (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">{t.usersOldPassword}</span>
                        ) : <span className="text-xs text-[#667085]">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F7F9FC]">
                            <div className={`h-full rounded-full ${fa2Rate >= 80 ? 'bg-emerald-500' : fa2Rate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${fa2Rate}%` }} />
                          </div>
                          <span className="text-xs font-medium text-[#667085]">{fa2Rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Security Events */}
      <div className="rounded-xl border border-[#E4E7EC] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#101828]">Recent Security Events (7 hari)</h2>
          <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter action, user, IP..."
            className="w-64 rounded-lg border border-[#E4E7EC] px-3 py-1.5 text-sm focus:border-[#0D6EFD] focus:outline-none" />
        </div>
        {filteredEvents.length === 0 ? (
          <div className="py-4 text-center text-sm text-[#667085]">Tidak ada event keamanan</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-[#F7F9FC] text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Aksi</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Path</th>
                  <th className="px-4 py-3">Detail</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((e) => (
                  <tr key={e.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                    <td className="px-4 py-3 text-xs text-[#667085]">{new Date(e.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-4 py-3 font-medium text-[#101828]">{e.userName}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ACTION_COLORS[e.action] || 'bg-gray-100 text-gray-600'}`}>
                        {ACTION_LABELS[e.action] || e.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#667085]">{e.ip || '-'}</td>
                    <td className="px-4 py-3 text-xs text-[#667085]">{e.path || '-'}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs text-[#667085]">{e.detail || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function BreakdownPill({ label, value, sub, pct, color }: { label: string; value: number; sub?: string; pct: number; color: string }) {
  const bg = color === 'red' ? 'bg-red-100 text-red-700' : color === 'amber' ? 'bg-amber-100 text-amber-700' : color === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700';
  return (
    <div className={`rounded-lg px-2 py-1.5 ${bg}`}>
      <div className="font-semibold">{label}</div>
      <div className="text-[10px] opacity-75">{value}{sub || ''} &middot; {pct}%</div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <div className={`rounded-xl border p-5 ${color}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
    </div>
  );
}
