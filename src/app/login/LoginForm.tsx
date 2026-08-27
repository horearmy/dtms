'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';

type Tenant = { id: string; name: string; slug: string; primaryColor: string };

function LoginFormInner() {
  const search = useSearchParams();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(
    () => search.get('twoFactorToken') || null
  );
  const [otp, setOtp] = useState('');
  const [error, setError] = useState(search.get('error') ? decodeURIComponent(search.get('error') || '') : '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/tenants')
      .then((r) => r.json())
      .then((data: Tenant[]) => {
        setTenants(data);
        if (data.length === 1) setSelectedTenant(data[0].id);
        if (data.length > 1) {
          const saved = localStorage.getItem('dtms_tenant_id');
          if (saved && data.some((t) => t.id === saved)) setSelectedTenant(saved);
        }
      })
      .catch(() => {});
  }, []);

  async function finishLogin(data: { mustChangePassword?: boolean; role?: string }) {
    const target = data.mustChangePassword ? '/account/password?first=1' : data.role === 'DRIVER' ? '/driver' : data.role === 'SUPER_ADMIN' ? '/tenants' : '/dashboard';
    // Force a fresh request so the browser includes the session cookie set by the API response.
    window.location.assign(target);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, tenantId: selectedTenant || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal login');
        setLoading(false);
        return;
      }
      if (selectedTenant) localStorage.setItem('dtms_tenant_id', selectedTenant);
      if (data.twoFactorRequired) {
        setTwoFactorToken(data.twoFactorToken);
        setLoading(false);
        return;
      }
      await finishLogin(data);
    } catch {
      setError('Terjadi kesalahan jaringan');
      setLoading(false);
    }
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/two-factor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: twoFactorToken, code: otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Kode verifikasi salah');
        setLoading(false);
        return;
      }
      await finishLogin(data);
    } catch {
      setError('Terjadi kesalahan jaringan');
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[400px]">
      <div className="rounded-2xl border border-[#E4E7EC] bg-white p-8 shadow-sm">
        {/* Logo */}
        <div className="mb-6 text-center">
          <img src="/logo.png" alt="Logo DTMS" className="mx-auto mb-3 h-14 w-14 rounded-2xl object-contain" />
          <h1 className="text-xl font-bold text-[#101828]">DTMS</h1>
          <p className="mt-0.5 text-sm text-[#667085]">
            {twoFactorToken ? 'Verifikasi 2 langkah' : 'Delivery Tracking Management System'}
          </p>
        </div>

        {!twoFactorToken ? (
          <form onSubmit={submit} className="space-y-4">
            {tenants.length > 1 && (
              <div>
                 <label htmlFor="tenant" className="mb-1.5 block text-sm font-medium text-[#101828]">Perusahaan</label>
                {tenants.length > 30 ? (
                  <>
                     <input
                       id="tenant"
                       name="tenantSearch"
                      type="text"
                      value={tenantSearch}
                      onChange={(e) => { setTenantSearch(e.target.value); setSelectedTenant(''); }}
                      placeholder="Ketik nama perusahaan..."
                      className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2.5 text-sm text-[#101828] focus:border-[#0D6EFD] focus:outline-none focus:ring-1 focus:ring-[#0D6EFD]"
                    />
                    {tenantSearch && (
                      <div className="relative mt-1 max-h-48 overflow-y-auto rounded-lg border border-[#E4E7EC] bg-white shadow-lg">
                        {tenants
                          .filter((t) => t.name.toLowerCase().includes(tenantSearch.toLowerCase()))
                          .slice(0, 50)
                          .map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => { setSelectedTenant(t.id); setTenantSearch(t.name); }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-[#F7F9FC] ${selectedTenant === t.id ? 'bg-[#E7F0FF] font-semibold text-[#0D6EFD]' : 'text-[#101828]'}`}
                            >
                              {t.name}
                            </button>
                          ))}
                        {tenants.filter((t) => t.name.toLowerCase().includes(tenantSearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-sm text-[#667085]">Perusahaan tidak ditemukan</div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                   <select
                     id="tenant"
                     name="tenantId"
                    value={selectedTenant}
                    onChange={(e) => setSelectedTenant(e.target.value)}
                    required
                    className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2.5 text-sm text-[#101828] focus:border-[#0D6EFD] focus:outline-none focus:ring-1 focus:ring-[#0D6EFD]"
                  >
                    <option value="">-- Pilih Perusahaan --</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            {tenants.length === 1 && <input id="tenantId" name="tenantId" type="hidden" value={tenants[0].id} readOnly />}

            <div>
               <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-[#101828]">Username</label>
               <input
                 id="username"
                 name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2.5 text-sm text-[#101828] placeholder:text-[#667085] focus:border-[#0D6EFD] focus:outline-none focus:ring-1 focus:ring-[#0D6EFD]"
                placeholder="Masukkan username"
              />
            </div>

            <div>
               <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#101828]">Password</label>
              <div className="relative">
                 <input
                   id="password"
                   name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2.5 pr-10 text-sm text-[#101828] placeholder:text-[#667085] focus:border-[#0D6EFD] focus:outline-none focus:ring-1 focus:ring-[#0D6EFD]"
                  placeholder="Masukkan password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#101828]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-[#F5222D]/10 px-3 py-2 text-sm font-medium text-[#F5222D]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (tenants.length > 1 && !selectedTenant)}
              className="w-full rounded-lg bg-[#0D6EFD] py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B5FD5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </button>

            <Link href="/forgot-password" className="block w-full text-center text-xs font-semibold text-[#667085] underline hover:text-[#101828]">
              Lupa password?
            </Link>

            {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#E4E7EC]" />
                  <span className="text-xs text-[#667085]">atau</span>
                  <div className="h-px flex-1 bg-[#E4E7EC]" />
                </div>
                <a
                  href="/api/auth/google"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#E4E7EC] bg-white py-2.5 text-sm font-semibold text-[#101828] transition hover:bg-[#F7F9FC]"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z" />
                  </svg>
                  Masuk dengan Google
                </a>
              </>
            )}
          </form>
        ) : (
          <form onSubmit={submitOtp} className="space-y-4">
            <div>
               <label htmlFor="otp" className="mb-1.5 block text-sm font-medium text-[#101828]">Kode 6 digit</label>
               <input
                 id="otp"
                 name="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                required
                autoFocus
                className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2.5 text-center text-lg tracking-[0.5em] text-[#101828] focus:border-[#0D6EFD] focus:outline-none focus:ring-1 focus:ring-[#0D6EFD]"
                placeholder="000000"
              />
              <p className="mt-2 text-xs text-[#667085]">
                Masukkan kode dari aplikasi autentikator atau kode cadangan 2FA Anda.
              </p>
            </div>
            {error && (
              <div className="rounded-lg bg-[#F5222D]/10 px-3 py-2 text-sm font-medium text-[#F5222D]">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#0D6EFD] py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B5FD5] disabled:opacity-60"
            >
              {loading ? 'Memverifikasi...' : 'Verifikasi'}
            </button>
            <button
              type="button"
              onClick={() => { setTwoFactorToken(null); setOtp(''); setError(''); }}
              className="w-full text-center text-xs font-semibold text-[#667085] underline hover:text-[#101828]"
            >
              ← Kembali ke login
            </button>
          </form>
        )}
      </div>

      {process.env.NODE_ENV === 'development' ? (
        <div className="mt-4 rounded-xl border border-[#E4E7EC] bg-white px-4 py-3 text-xs text-[#667085]">
          <b className="text-[#101828]">Akun demo:</b> superadmin/admin123 · admin/admin123 · dispatcher/admin123 ·
          warehouse/admin123 · driver1/driver123
          <br />
          Cek status kiriman: <a href="/tracking" className="font-semibold text-[#0D6EFD] underline">Tracking Resi</a>
        </div>
      ) : null}
    </div>
  );
}

export default function LoginForm() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-[400px] rounded-2xl border border-[#E4E7EC] bg-white p-8 text-center text-sm text-[#667085] shadow-sm">
        Memuat...
      </div>
    }>
      <LoginFormInner />
    </Suspense>
  );
}
