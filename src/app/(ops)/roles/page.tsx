'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, Users, Check, X, Save, Loader2 } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/constants';

type Perm = { code: string; resource: string; action: string; label: string | null; granted: boolean };
type RoleData = { role: string; userCount: number; permissions: Perm[] };
type ApiResult = { roles: RoleData[]; resources: string[]; allPermissions: { code: string; resource: string; action: string; label: string | null }[] };

const ROLE_ORDER = ['SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'WAREHOUSE', 'SUPERVISOR', 'MANAGEMENT', 'CUSTOMER_SERVICE', 'DRIVER', 'CUSTOMER'];
const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700',
  ADMIN_OPERASIONAL: 'bg-purple-100 text-purple-700',
  DISPATCHER: 'bg-blue-100 text-blue-700',
  WAREHOUSE: 'bg-amber-100 text-amber-700',
  SUPERVISOR: 'bg-emerald-100 text-emerald-700',
  MANAGEMENT: 'bg-indigo-100 text-indigo-700',
  CUSTOMER_SERVICE: 'bg-cyan-100 text-cyan-700',
  DRIVER: 'bg-orange-100 text-orange-700',
  CUSTOMER: 'bg-gray-100 text-gray-700',
};

const btnPrimary = 'rounded-lg bg-[#0D6EFD] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0B5FD5] disabled:opacity-50';
const btnGhost = 'rounded-lg border border-[#E4E7EC] px-4 py-2 text-sm font-medium text-[#344054] hover:bg-[#F7F9FC]';

export default function RolesPage() {
  const [data, setData] = useState<ApiResult | null>(null);
  const [activeRole, setActiveRole] = useState<string>('');
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/roles');
      if (res.ok) {
        const d = await res.json();
        setData(d);
        if (d.roles.length > 0) {
          setActiveRole(prev => {
            if (prev && d.roles.find((r: RoleData) => r.role === prev)) return prev;
            const first = d.roles.find((r: RoleData) => r.role === 'ADMIN_OPERASIONAL') || d.roles[0];
            return first.role;
          });
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!data) return;
    const rd = data.roles.find((r: RoleData) => r.role === activeRole);
    if (rd) setGranted(new Set(rd.permissions.filter((p: Perm) => p.granted).map((p: Perm) => p.code)));
  }, [activeRole, data]);

  const roleData = data?.roles.find((r) => r.role === activeRole);

  function toggle(code: string) {
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleResource(resource: string) {
    const perms = roleData?.permissions.filter((p) => p.resource === resource) || [];
    const allGranted = perms.every((p) => granted.has(p.code));
    setGranted((prev) => {
      const next = new Set(prev);
      for (const p of perms) {
        if (allGranted) next.delete(p.code);
        else next.add(p.code);
      }
      return next;
    });
  }

  async function saveRole() {
    if (!roleData) return;
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: activeRole, permissions: Array.from(granted) }),
      });
      const d = await res.json();
      if (!res.ok) return setMsg(d.error || 'Gagal menyimpan');
      setMsg('Berhasil disimpan!');
      await load();
    } catch {
      setMsg('Gagal menyimpan');
    }
    setSaving(false);
  }

  if (loading) return <div className="py-12 text-center text-sm text-[#667085]">Memuat roles & permissions...</div>;
  if (!data) return <div className="py-12 text-center text-sm text-red-600">Gagal memuat data</div>;

  const resources = data.resources;
  const isSuperAdmin = activeRole === 'SUPER_ADMIN';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#101828]">Roles & Permissions</h1>
        <p className="text-sm text-[#667085]">Kelola hak akses per role untuk tenant ini.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ROLE_ORDER.filter((r) => data.roles.some((rd) => rd.role === r)).map((role) => {
          const rd = data.roles.find((r) => r.role === role)!;
          const active = role === activeRole;
          return (
            <button
              key={role}
              onClick={() => { setActiveRole(role); setGranted(new Set(rd.permissions.filter((p) => p.granted).map((p) => p.code))); setMsg(''); }}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                active ? 'border-[#0D6EFD] bg-[#E7F0FF] text-[#0D6EFD]' : 'border-[#E4E7EC] bg-white text-[#344054] hover:bg-[#F7F9FC]'
              }`}
            >
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${ROLE_COLORS[role] || 'bg-gray-100 text-gray-700'}`}>
                {ROLE_LABELS[role] || role}
              </span>
              <span className="flex items-center gap-1 text-xs text-[#667085]">
                <Users size={12} /> {rd.userCount}
              </span>
            </button>
          );
        })}
      </div>

      {msg && (
        <div className={`rounded-lg px-3 py-2 text-sm ${msg.includes('Berhasil') ? 'bg-[#E6F9EF] text-[#16B364]' : 'bg-[#FEF0F0] text-[#F5222D]'}`}>
          {msg}
        </div>
      )}

      {roleData && (
        <div className="rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between border-b border-[#E4E7EC] px-6 py-4">
            <div className="flex items-center gap-3">
              <Shield size={20} className="text-[#0D6EFD]" />
              <div>
                <span className="font-semibold text-[#101828]">{ROLE_LABELS[activeRole] || activeRole}</span>
                <span className="ml-2 text-xs text-[#667085]">— {Array.from(granted).length} dari {roleData.permissions.length} permissions</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setGranted(new Set(roleData.permissions.map((p) => p.code)))} className={btnGhost + ' text-xs'}>Select All</button>
              <button onClick={() => setGranted(new Set())} className={btnGhost + ' text-xs'}>Clear All</button>
              <button onClick={saveRole} disabled={saving || isSuperAdmin} className={btnPrimary + ' flex items-center gap-1'}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Simpan
              </button>
            </div>
          </div>

          <div className="divide-y divide-[#E4E7EC]">
            {isSuperAdmin && (
              <div className="px-6 py-4 text-sm text-[#667085]">
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Full Access</span>
                <span className="ml-2">Super Admin memiliki akses penuh ke semua resource secara default.</span>
              </div>
            )}
            {resources.map((resource) => {
              const perms = roleData.permissions.filter((p) => p.resource === resource);
              if (perms.length === 0) return null;
              const allGranted = perms.every((p) => granted.has(p.code));
              const someGranted = perms.some((p) => granted.has(p.code));
              return (
                <div key={resource} className="px-6 py-4">
                  <div className="mb-2 flex items-center gap-2">
                    <button onClick={() => toggleResource(resource)} className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#667085] hover:text-[#101828]">
                      {allGranted ? <Check size={14} className="text-[#16B364]" /> : someGranted ? <div className="h-3.5 w-3.5 rounded-sm border-2 border-[#0D6EFD] bg-[#0D6EFD]/30" /> : <X size={14} className="text-[#98A2B3]" />}
                      {resource.replace('_', ' ')}
                    </button>
                    <span className="text-[10px] text-[#98A2B3]">{perms.filter((p) => granted.has(p.code)).length}/{perms.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {perms.map((p) => {
                      const g = granted.has(p.code);
                      return (
                        <button
                          key={p.code}
                          onClick={() => toggle(p.code)}
                          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                            g
                              ? 'bg-[#E6F9EF] text-[#16B364] border border-[#16B364]/30'
                              : 'bg-[#F7F9FC] text-[#667085] border border-[#E4E7EC] hover:bg-[#E4E7EC]'
                          }`}
                        >
                          {g ? <Check size={12} /> : <X size={12} />}
                          {p.label || p.action}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
