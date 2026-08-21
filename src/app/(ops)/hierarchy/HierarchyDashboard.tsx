'use client';

import { useEffect, useState, useMemo } from 'react';
import { Building2, Globe, Building, DoorOpen, MapPin, Users, Warehouse, ChevronRight, Search, X } from 'lucide-react';

type Tenant = { id: string; name: string; slug: string; plan: string; status: string };

type Org = {
  id: string; name: string; code: string | null; description: string | null; active: boolean;
  _count: { regions: number; branches: number };
};

type Region = {
  id: string; name: string; code: string | null; description: string | null; active: boolean;
  organizationId: string | null;
  organization: { id: string; name: string } | null;
  _count: { branches: number };
};

type Branch = {
  id: string; name: string; code: string | null; address: string | null; city: string | null; active: boolean;
  organizationId: string | null;
  regionId: string | null;
  organization: { id: string; name: string } | null;
  region: { id: string; name: string } | null;
  _count: { users: number; warehouses: number; hubs: number };
};

type Department = {
  id: string; name: string; code: string | null; active: boolean;
  branch: { id: string; name: string } | null;
  company: { id: string; name: string } | null;
};

type Hub = {
  id: string; name: string; code: string | null; address: string | null; city: string | null; active: boolean;
  branch: { id: string; name: string };
};

type Overview = {
  tenant: Tenant | null;
  organizations: Org[];
  regions: Region[];
  branches: Branch[];
  departments: Department[];
  hubs: Hub[];
};

type Tab = 'overview' | 'organizations' | 'regions' | 'branches' | 'departments' | 'hubs';

export default function HierarchyDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');
  const [showTenantDropdown, setShowTenantDropdown] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  useEffect(() => {
    fetch('/api/tenants')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : data.tenants || [];
        setTenants(list);
        setTenantLoading(false);
      })
      .catch(() => setTenantLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTenantId) { setOverview(null); return; }
    setLoading(true);
    fetch(`/api/hierarchy/overview?tenantId=${selectedTenantId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setOverview(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedTenantId]);

  const filteredTenants = useMemo(() => {
    if (!tenantSearch) return tenants;
    const q = tenantSearch.toLowerCase();
    return tenants.filter(t => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
  }, [tenants, tenantSearch]);

  const selectedTenant = tenants.find(t => t.id === selectedTenantId);

  const stats = overview ? [
    { label: 'Organizations', value: overview.organizations.length, icon: <Building2 size={20} />, color: 'bg-blue-50 text-blue-700' },
    { label: 'Regions', value: overview.regions.length, icon: <Globe size={20} />, color: 'bg-violet-50 text-violet-700' },
    { label: 'Branches', value: overview.branches.length, icon: <Building size={20} />, color: 'bg-amber-50 text-amber-700' },
    { label: 'Departments', value: overview.departments.length, icon: <DoorOpen size={20} />, color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Hubs', value: overview.hubs.length, icon: <MapPin size={20} />, color: 'bg-rose-50 text-rose-700' },
    { label: 'Total Users', value: overview.branches.reduce((s, b) => s + b._count.users, 0), icon: <Users size={20} />, color: 'bg-cyan-50 text-cyan-700' },
  ] : [];

  const tabs: { key: Tab; label: string; count: number }[] = overview ? [
    { key: 'overview', label: 'Ringkasan', count: 0 },
    { key: 'organizations', label: 'Organizations', count: overview.organizations.length },
    { key: 'regions', label: 'Regions', count: overview.regions.length },
    { key: 'branches', label: 'Branches', count: overview.branches.length },
    { key: 'departments', label: 'Departments', count: overview.departments.length },
    { key: 'hubs', label: 'Hubs', count: overview.hubs.length },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Tenant Selector */}
      <div className="relative">
        <label className="mb-1 block text-sm font-medium text-[#101828]">Pilih Tenant Kepala</label>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" />
          <input
            className="w-full rounded-lg border border-[#E4E7EC] bg-white py-2.5 pl-10 pr-10 text-sm"
            placeholder={tenantLoading ? 'Memuat tenant...' : 'Cari tenant berdasarkan nama atau slug...'}
            value={selectedTenantId ? selectedTenant?.name || '' : tenantSearch}
            onChange={e => {
              setTenantSearch(e.target.value);
              setShowTenantDropdown(true);
              if (selectedTenantId) { setSelectedTenantId(''); setOverview(null); }
            }}
            onFocus={() => setShowTenantDropdown(true)}
            disabled={tenantLoading}
          />
          {selectedTenantId && (
            <button onClick={() => { setSelectedTenantId(''); setOverview(null); setTenantSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#101828]">
              <X size={16} />
            </button>
          )}
          {showTenantDropdown && !selectedTenantId && (
            <div className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#E4E7EC] bg-white shadow-lg">
              {filteredTenants.length === 0 ? (
                <div className="px-4 py-3 text-sm text-[#667085]">Tidak ada tenant ditemukan</div>
              ) : filteredTenants.slice(0, 100).map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTenantId(t.id); setShowTenantDropdown(false); setTenantSearch(''); }}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-gray-50"
                >
                  <div>
                    <div className="font-medium text-[#101828]">{t.name}</div>
                    <div className="text-xs text-[#667085]">{t.slug}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{t.plan}</span>
                    <ChevronRight size={14} className="text-[#667085]" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close dropdown */}
      {showTenantDropdown && <div className="fixed inset-0 z-30" onClick={() => setShowTenantDropdown(false)} />}

      {/* Loading */}
      {loading && (
        <div className="rounded-xl border bg-white p-12 text-center text-sm text-[#667085]">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#2563eb] border-t-transparent" />
          Memuat data hierarki...
        </div>
      )}

      {/* No selection */}
      {!selectedTenantId && !loading && (
        <div className="rounded-xl border bg-white p-16 text-center">
          <Building2 size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-[#101828]">Pilih Tenant</h3>
          <p className="mt-2 text-sm text-[#667085]">Pilih tenant di atas untuk melihat seluruh struktur hierarki organisasi.</p>
        </div>
      )}

      {/* Data loaded */}
      {overview && !loading && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map(s => (
              <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
                <div className="flex items-center gap-2 mb-2">{s.icon}<span className="text-xs font-medium opacity-80">{s.label}</span></div>
                <div className="text-2xl font-bold">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition ${
                  activeTab === t.key ? 'bg-white text-[#101828] shadow-sm' : 'text-[#667085] hover:text-[#101828]'
                }`}
              >
                {t.label}{t.count > 0 ? ` (${t.count})` : ''}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="rounded-xl border bg-white">
            {activeTab === 'overview' && <OverviewTab overview={overview} />}
            {activeTab === 'organizations' && <OrganizationsTab orgs={overview.organizations} />}
            {activeTab === 'regions' && <RegionsTab regions={overview.regions} />}
            {activeTab === 'branches' && <BranchesTab branches={overview.branches} />}
            {activeTab === 'departments' && <DepartmentsTab departments={overview.departments} />}
            {activeTab === 'hubs' && <HubsTab hubs={overview.hubs} />}
          </div>
        </>
      )}
    </div>
  );
}

/* ───── Overview Tab ───── */
function OverviewTab({ overview }: { overview: Overview }) {
  const orgTree = useMemo(() => {
    const map = new Map<string, { org: Org; regions: { region: Region; branches: Branch[] }[]; standaloneBranches: Branch[] }>();
    for (const org of overview.organizations) {
      map.set(org.id, { org, regions: [], standaloneBranches: [] });
    }
    for (const r of overview.regions) {
      if (r.organizationId && map.has(r.organizationId)) {
        map.get(r.organizationId)!.regions.push({ region: r, branches: [] });
      }
    }
    for (const b of overview.branches) {
      if (b.region) {
        const entry = [...map.values()].find(e => e.regions.some(r => r.region.id === b.region!.id));
        if (entry) {
          const reg = entry.regions.find(r => r.region.id === b.region!.id);
          if (reg) reg.branches.push(b);
          continue;
        }
      }
      if (b.organizationId && map.has(b.organizationId)) {
        map.get(b.organizationId)!.standaloneBranches.push(b);
      }
    }
    return [...map.values()];
  }, [overview]);

  const unassignedRegions = overview.regions.filter(r => !r.organizationId);
  const unassignedBranches = overview.branches.filter(b => !b.organizationId && !b.region);

  return (
    <div className="p-6">
      <h3 className="mb-4 text-base font-semibold text-[#101828]">Struktur Hierarki</h3>
      <div className="space-y-4">
        {orgTree.map(({ org, regions, standaloneBranches }) => (
          <div key={org.id} className="rounded-lg border border-[#E4E7EC] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 size={16} className="text-blue-600" />
              <span className="font-semibold text-[#101828]">{org.name}</span>
              {org.code && <span className="text-xs font-mono text-[#667085]">{org.code}</span>}
              <span className="text-xs text-[#667085]">({org._count.regions} region, {org._count.branches} branch)</span>
            </div>
            {regions.map(({ region, branches }) => (
              <div key={region.id} className="ml-6 mt-2">
                <div className="flex items-center gap-2 text-sm">
                  <Globe size={14} className="text-violet-500" />
                  <span className="font-medium text-[#101828]">{region.name}</span>
                  {region.code && <span className="text-xs font-mono text-[#667085]">{region.code}</span>}
                  <span className="text-xs text-[#667085]">({region._count.branches} branch)</span>
                </div>
                {branches.map(b => (
                  <div key={b.id} className="ml-6 mt-1 flex items-center gap-2 text-sm">
                    <Building size={13} className="text-amber-500" />
                    <span className="text-[#101828]">{b.name}</span>
                    {b.city && <span className="text-xs text-[#667085]">({b.city})</span>}
                    <span className="text-xs text-[#667085]">{b._count.users} user</span>
                  </div>
                ))}
              </div>
            ))}
            {standaloneBranches.map(b => (
              <div key={b.id} className="ml-6 mt-2 flex items-center gap-2 text-sm">
                <Building size={13} className="text-amber-500" />
                <span className="text-[#101828]">{b.name}</span>
                {b.city && <span className="text-xs text-[#667085]">({b.city})</span>}
                <span className="text-xs text-[#667085]">{b._count.users} user</span>
              </div>
            ))}
          </div>
        ))}

        {unassignedRegions.length > 0 && (
          <div className="rounded-lg border border-dashed border-[#E4E7EC] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe size={16} className="text-violet-500" />
              <span className="text-sm font-medium text-[#667085]">Regions Tanpa Organization ({unassignedRegions.length})</span>
            </div>
            {unassignedRegions.map(r => (
              <div key={r.id} className="ml-6 mt-1 flex items-center gap-2 text-sm">
                <span className="text-[#101828]">{r.name}</span>
                {r.code && <span className="text-xs font-mono text-[#667085]">{r.code}</span>}
                <span className="text-xs text-[#667085]">({r._count.branches} branch)</span>
              </div>
            ))}
          </div>
        )}

        {unassignedBranches.length > 0 && (
          <div className="rounded-lg border border-dashed border-[#E4E7EC] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building size={16} className="text-amber-500" />
              <span className="text-sm font-medium text-[#667085]">Branches Tanpa Organization ({unassignedBranches.length})</span>
            </div>
            {unassignedBranches.map(b => (
              <div key={b.id} className="ml-6 mt-1 flex items-center gap-2 text-sm">
                <span className="text-[#101828]">{b.name}</span>
                {b.city && <span className="text-xs text-[#667085]">({b.city})</span>}
              </div>
            ))}
          </div>
        )}

        {overview.organizations.length === 0 && overview.regions.length === 0 && overview.branches.length === 0 && (
          <div className="py-8 text-center text-sm text-[#667085]">Tidak ada data hierarki untuk tenant ini.</div>
        )}
      </div>

      {/* Departments & Hubs */}
      {(overview.departments.length > 0 || overview.hubs.length > 0) && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {overview.departments.length > 0 && (
            <div className="rounded-lg border border-[#E4E7EC] p-4">
              <div className="flex items-center gap-2 mb-3">
                <DoorOpen size={16} className="text-emerald-600" />
                <span className="font-semibold text-[#101828]">Departments ({overview.departments.length})</span>
              </div>
              <div className="space-y-1.5">
                {overview.departments.slice(0, 10).map(d => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <span className="text-[#101828]">{d.name}</span>
                    {d.branch && <span className="text-xs text-[#667085]">{d.branch.name}</span>}
                  </div>
                ))}
                {overview.departments.length > 10 && <div className="text-xs text-[#667085]">+{overview.departments.length - 10} lainnya</div>}
              </div>
            </div>
          )}
          {overview.hubs.length > 0 && (
            <div className="rounded-lg border border-[#E4E7EC] p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin size={16} className="text-rose-600" />
                <span className="font-semibold text-[#101828]">Hubs ({overview.hubs.length})</span>
              </div>
              <div className="space-y-1.5">
                {overview.hubs.slice(0, 10).map(h => (
                  <div key={h.id} className="flex items-center justify-between text-sm">
                    <span className="text-[#101828]">{h.name}</span>
                    {h.branch && <span className="text-xs text-[#667085]">{h.branch.name}</span>}
                  </div>
                ))}
                {overview.hubs.length > 10 && <div className="text-xs text-[#667085]">+{overview.hubs.length - 10} lainnya</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───── Organizations Tab ───── */
function OrganizationsTab({ orgs }: { orgs: Org[] }) {
  if (orgs.length === 0) return <EmptyState label="organizations" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-[#667085]">
            <th className="px-4 py-3">Nama</th>
            <th className="px-4 py-3">Kode</th>
            <th className="px-4 py-3">Regions</th>
            <th className="px-4 py-3">Branches</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {orgs.map(o => (
            <tr key={o.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-[#101828]">{o.name}</td>
              <td className="px-4 py-3 font-mono text-xs text-[#667085]">{o.code || '—'}</td>
              <td className="px-4 py-3">{o._count.regions}</td>
              <td className="px-4 py-3">{o._count.branches}</td>
              <td className="px-4 py-3"><StatusBadge active={o.active} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───── Regions Tab ───── */
function RegionsTab({ regions }: { regions: Region[] }) {
  if (regions.length === 0) return <EmptyState label="regions" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-[#667085]">
            <th className="px-4 py-3">Nama</th>
            <th className="px-4 py-3">Kode</th>
            <th className="px-4 py-3">Organization</th>
            <th className="px-4 py-3">Branches</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {regions.map(r => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-[#101828]">{r.name}</td>
              <td className="px-4 py-3 font-mono text-xs text-[#667085]">{r.code || '—'}</td>
              <td className="px-4 py-3 text-[#667085]">{r.organization?.name || '—'}</td>
              <td className="px-4 py-3">{r._count.branches}</td>
              <td className="px-4 py-3"><StatusBadge active={r.active} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───── Branches Tab ───── */
function BranchesTab({ branches }: { branches: Branch[] }) {
  if (branches.length === 0) return <EmptyState label="branches" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-[#667085]">
            <th className="px-4 py-3">Nama</th>
            <th className="px-4 py-3">Kode</th>
            <th className="px-4 py-3">Organization</th>
            <th className="px-4 py-3">Region</th>
            <th className="px-4 py-3">Kota</th>
            <th className="px-4 py-3">Users</th>
            <th className="px-4 py-3">Hubs</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {branches.map(b => (
            <tr key={b.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-[#101828]">{b.name}</td>
              <td className="px-4 py-3 font-mono text-xs text-[#667085]">{b.code || '—'}</td>
              <td className="px-4 py-3 text-[#667085]">{b.organization?.name || '—'}</td>
              <td className="px-4 py-3 text-[#667085]">{b.region?.name || '—'}</td>
              <td className="px-4 py-3 text-[#667085]">{b.city || '—'}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1"><Users size={13} className="text-[#667085]" />{b._count.users}</span>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1"><MapPin size={13} className="text-[#667085]" />{b._count.hubs}</span>
              </td>
              <td className="px-4 py-3"><StatusBadge active={b.active} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───── Departments Tab ───── */
function DepartmentsTab({ departments }: { departments: Department[] }) {
  if (departments.length === 0) return <EmptyState label="departments" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-[#667085]">
            <th className="px-4 py-3">Nama</th>
            <th className="px-4 py-3">Kode</th>
            <th className="px-4 py-3">Branch</th>
            <th className="px-4 py-3">Organization</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {departments.map(d => (
            <tr key={d.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-[#101828]">{d.name}</td>
              <td className="px-4 py-3 font-mono text-xs text-[#667085]">{d.code || '—'}</td>
              <td className="px-4 py-3 text-[#667085]">{d.branch?.name || '—'}</td>
              <td className="px-4 py-3 text-[#667085]">{d.company?.name || '—'}</td>
              <td className="px-4 py-3"><StatusBadge active={d.active} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───── Hubs Tab ───── */
function HubsTab({ hubs }: { hubs: Hub[] }) {
  if (hubs.length === 0) return <EmptyState label="hubs" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-[#667085]">
            <th className="px-4 py-3">Nama</th>
            <th className="px-4 py-3">Kode</th>
            <th className="px-4 py-3">Branch</th>
            <th className="px-4 py-3">Kota</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {hubs.map(h => (
            <tr key={h.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-[#101828]">{h.name}</td>
              <td className="px-4 py-3 font-mono text-xs text-[#667085]">{h.code || '—'}</td>
              <td className="px-4 py-3 text-[#667085]">{h.branch?.name}</td>
              <td className="px-4 py-3 text-[#667085]">{h.city || '—'}</td>
              <td className="px-4 py-3"><StatusBadge active={h.active} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───── Shared ───── */
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      {active ? 'Aktif' : 'Nonaktif'}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="p-12 text-center text-sm text-[#667085]">
      Belum ada {label} untuk tenant ini.
    </div>
  );
}
