"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function PasswordFormInner() {
  const router = useRouter();
  const search = useSearchParams();
  const first = search.get('first') === '1';

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(async (r) => {
      if (!r.ok) router.push('/login');
    });
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (next !== confirm) {
      setError('Konfirmasi password tidak sama');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal mengubah password');
        setLoading(false);
        return;
      }
      setSuccess(data.message || 'Password berhasil diubah');
      setCurrent('');
      setNext('');
      setConfirm('');
      const me = await fetch('/api/auth/me');
      const meData = await me.json();
      const target = meData.user?.role === 'DRIVER' ? '/driver' : '/dashboard';
      setTimeout(() => router.push(target), 1200);
    } catch {
      setError('Terjadi kesalahan jaringan');
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0D6EFD] text-2xl font-bold text-white">DT</div>
          <h1 className="text-xl font-bold text-[#101828]">Ganti Password</h1>
          {first ? (
            <p className="mt-1 text-sm text-amber-600">Anda harus mengganti password default sebelum melanjutkan.</p>
          ) : (
            <p className="mt-1 text-sm text-[#667085]">Perbarui password akun Anda</p>
          )}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#667085]">Password Lama</label>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#667085]">Password Baru</label>
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none"
              placeholder="Min. 8 karakter, kombinasi huruf & angka"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#667085]">Konfirmasi Password Baru</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none"
            />
          </div>
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          {success && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#0D6EFD] py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B5FD5] disabled:opacity-60"
          >
            {loading ? 'Memproses...' : 'Simpan Password'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/driver" onClick={(e) => { e.preventDefault(); router.push(first ? '/login' : '/dashboard'); }} className="text-xs font-semibold text-[#0D6EFD] underline">
            {first ? 'Keluar' : '← Kembali'}
          </Link>
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-white/70 px-4 py-3 text-xs text-[#667085]">
        Kebijakan password: minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka.
      </div>
    </div>
  );
}

export default function PasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F9FC] px-4 py-8">
      <Suspense fallback={<div className="text-sm text-[#667085]">Memuat...</div>}>
        <PasswordFormInner />
      </Suspense>
    </div>
  );
}
