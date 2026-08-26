'use client';

import { useCallback, useEffect, useState } from 'react';
import { Monitor, Smartphone, Shield, Trash2, History, RefreshCw } from 'lucide-react';

type SessionRow = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  authenticationMethod: string;
  riskLevel: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
};

type HistoryRow = {
  id: string;
  action: string;
  ip: string | null;
  userAgent: string | null;
  reason: string;
  createdAt: string;
};

function deviceLabel(ua: string | null): { icon: 'desktop' | 'mobile'; label: string } {
  const s = ua || '';
  if (/Mobile|Android|iPhone/i.test(s)) return { icon: 'mobile', label: /Android/i.test(s) ? 'Android' : /iPhone|iPad/i.test(s) ? 'iOS' : 'Mobile' };
  if (/Windows/i.test(s)) return { icon: 'desktop', label: 'Windows' };
  if (/Macintosh|Mac OS/i.test(s)) return { icon: 'desktop', label: 'macOS' };
  if (/Linux/i.test(s)) return { icon: 'desktop', label: 'Linux' };
  return { icon: 'desktop', label: 'Perangkat tidak dikenal' };
}

function browserLabel(ua: string | null): string {
  const s = ua || '';
  if (/Edg\//i.test(s)) return 'Edge';
  if (/Chrome\//i.test(s)) return 'Chrome';
  if (/Firefox\//i.test(s)) return 'Firefox';
  if (/Safari\//i.test(s)) return 'Safari';
  return 'Browser';
}

function rel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'baru saja';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} mnt lalu`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} jam lalu`;
  return new Date(iso).toLocaleString('id-ID');
}

const ACTION_LABEL: Record<string, string> = {
  SUPERADMIN_SESSION_CREATED: 'Login berhasil',
  SUPERADMIN_LOGIN_FAILED: 'Password salah',
  SUPERADMIN_MFA_FAILED: 'Kode 2FA salah',
  SUPERADMIN_SESSION_REVOKED: 'Sesi dicabut',
  SUPERADMIN_LOGIN_BLOCKED: 'Diblokir kebijakan',
  SUPERADMIN_SECRET_FAILED: 'Secret key salah',
};

export default function AdminSessionsPanel() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, hRes] = await Promise.all([fetch('/api/admin/auth/sessions'), fetch('/api/admin/security/login-history')]);
      if (sRes.ok) setSessions((await sRes.json()).items || []);
      if (hRes.ok) setHistory((await hRes.json()).items || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function revoke(id: string) {
    const res = await fetch(`/api/admin/auth/sessions?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setMsg('Sesi dicabut.');
      setTimeout(() => setMsg(''), 3000);
    }
  }

  async function revokeAll() {
    if (!confirm('Cabut SEMUA sesi aktif (termasuk perangkat ini)? Anda harus login ulang.')) return;
    const res = await fetch('/api/admin/auth/sessions/revoke-all', { method: 'POST' });
    if (res.ok) window.location.href = '/admin/secure-login';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#101828]">Devices &amp; Sessions</h2>
          <p className="text-sm text-[#667085]">Kelola sesi login privileged Anda</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm text-[#344054] hover:bg-[#F7F9FC]">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Muat ulang
          </button>
          <button onClick={revokeAll} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">
            Cabut semua sesi
          </button>
        </div>
      </div>

      {msg && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>}

      {/* Active sessions */}
      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
        <div className="border-b border-[#E4E7EC] px-4 py-3 text-sm font-bold text-[#101828]">Sesi Aktif ({sessions.length})</div>
        {loading && sessions.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#667085]">Memuat…</div>
        ) : sessions.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#667085]">Tidak ada sesi aktif</div>
        ) : (
          <ul className="divide-y divide-[#E4E7EC]">
            {sessions.map((s) => {
              const dev = deviceLabel(s.userAgent);
              return (
                <li key={s.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 rounded-lg bg-[#F2F4F7] p-2 text-[#344054]">
                      {dev.icon === 'mobile' ? <Smartphone size={16} /> : <Monitor size={16} />}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-[#101828]">
                        {browserLabel(s.userAgent)} · {dev.label}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#667085]">
                        <span>IP {s.ip || '-'}</span>
                        <span>·</span>
                        <span>Aktif {rel(s.lastActivityAt)}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Shield size={11} />
                          {s.authenticationMethod === 'password+totp' ? 'Password + 2FA' : 'Password'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => revoke(s.id)}
                    title="Cabut sesi ini"
                    className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Login history */}
      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
        <div className="flex items-center gap-2 border-b border-[#E4E7EC] px-4 py-3 text-sm font-bold text-[#101828]">
          <History size={15} /> Riwayat Login
        </div>
        {history.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#667085]">Belum ada riwayat</div>
        ) : (
          <ul className="divide-y divide-[#E4E7EC]">
            {history.map((h) => {
              const failed = /FAILED|BLOCKED/.test(h.action);
              return (
                <li key={h.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-sm ${failed ? 'font-medium text-red-600' : 'text-[#101828]'}`}>
                      {ACTION_LABEL[h.action] || h.action}{h.reason ? ` — ${h.reason}` : ''}
                    </span>
                    <span className="shrink-0 text-xs text-[#667085]">{rel(h.createdAt)}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-[#667085]">IP {h.ip || '-'} · {browserLabel(h.userAgent)}</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
