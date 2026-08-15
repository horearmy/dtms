"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginFormInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(
    () => search.get('twoFactorToken') || null
  );
  const [otp, setOtp] = useState('');
  const [error, setError] = useState(search.get('error') ? decodeURIComponent(search.get('error') || '') : '');
  const [loading, setLoading] = useState(false);

  async function finishLogin(data: { mustChangePassword?: boolean; role?: string }) {
    const target = data.mustChangePassword ? '/account/password?first=1' : data.role === 'DRIVER' ? '/driver' : '/dashboard';
    router.push(target);
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal login');
        setLoading(false);
        return;
      }
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
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white">
            DT
          </div>
          <h1 className="text-xl font-bold text-gray-900">Delivery Tracking & Management System</h1>
          <p className="mt-1 text-sm text-gray-500">
            {twoFactorToken ? 'Verifikasi 2 langkah' : 'Masuk untuk melanjutkan'}
          </p>
        </div>

        {!twoFactorToken ? (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                placeholder="contoh: admin"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                placeholder="******"
              />
            </div>
            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
            {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs text-gray-400">atau</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
                <a
                  href="/api/auth/google"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
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
              <label className="mb-1 block text-sm font-medium text-gray-700">Kode 6 digit</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                required
                autoFocus
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-lg tracking-[0.5em] focus:border-brand-500 focus:outline-none"
                placeholder="000000"
              />
              <p className="mt-2 text-xs text-gray-500">
                Masukkan kode dari aplikasi autentikator atau kode cadangan 2FA Anda.
              </p>
            </div>
            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? 'Memverifikasi...' : 'Verifikasi'}
            </button>
            <button
              type="button"
              onClick={() => { setTwoFactorToken(null); setOtp(''); setError(''); }}
              className="w-full text-center text-xs font-semibold text-gray-500 underline"
            >
              ← Kembali
            </button>
          </form>
        )}
      </div>
      <div className="mt-4 rounded-xl bg-white/70 px-4 py-3 text-xs text-gray-600">
        <b>Akun demo:</b> superadmin/admin123 · admin/admin123 · dispatcher/admin123 ·
        warehouse/admin123 · driver1/driver123<br />
        Cek status kiriman: <a href="/tracking" className="font-semibold text-brand-600 underline">Tracking Resi</a>
      </div>
    </div>
  );
}

export default function LoginForm() {
  return (
    <Suspense fallback={<div className="w-full max-w-md rounded-2xl bg-white p-8 text-center text-sm text-gray-400 shadow-lg">Memuat...</div>}>
      <LoginFormInner />
    </Suspense>
  );
}
