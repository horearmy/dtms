'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Package, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

function ResetPasswordInner() {
  const search = useSearchParams();
  const token = search.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setResult({ ok: false, message: 'Password konfirmasi tidak cocok' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      setResult({ ok: data.ok || res.ok, message: data.message || data.error });
    } catch {
      setResult({ ok: false, message: 'Terjadi kesalahan jaringan' });
    }
    setLoading(false);
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F9FC] px-4">
        <div className="w-full max-w-[400px] rounded-2xl border border-[#E4E7EC] bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5222D]">
            <Package size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-[#101828]">Token Tidak Valid</h1>
          <p className="mt-2 text-sm text-[#667085]">Link reset password tidak valid atau sudah kedaluwarsa.</p>
          <Link href="/forgot-password" className="mt-4 inline-block text-sm font-semibold text-[#0D6EFD] underline">
            Minta reset baru
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F9FC] px-4">
      <div className="w-full max-w-[400px]">
        <div className="rounded-2xl border border-[#E4E7EC] bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0D6EFD]">
              <Package size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-[#101828]">Reset Password</h1>
            <p className="mt-0.5 text-sm text-[#667085]">Masukkan password baru Anda</p>
          </div>

          {result ? (
            <div className="space-y-4">
              <div className={`rounded-lg px-3 py-2 text-sm ${result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F5222D]/10 text-[#F5222D]'}`}>
                {result.message}
              </div>
              {result.ok && (
                <Link
                  href="/login"
                  className="block w-full text-center text-sm font-semibold text-[#0D6EFD] underline hover:text-[#0B5FD5]"
                >
                  &larr; Login sekarang
                </Link>
              )}
              {!result.ok && (
                <Link
                  href="/forgot-password"
                  className="block w-full text-center text-sm font-semibold text-[#0D6EFD] underline hover:text-[#0B5FD5]"
                >
                  Minta reset baru
                </Link>
              )}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#101828]">Password Baru</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2.5 pr-10 text-sm text-[#101828] placeholder:text-[#667085] focus:border-[#0D6EFD] focus:outline-none focus:ring-1 focus:ring-[#0D6EFD]"
                    placeholder="min. 8 karakter, huruf besar, kecil, angka"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#101828]">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#101828]">Konfirmasi Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2.5 text-sm text-[#101828] placeholder:text-[#667085] focus:border-[#0D6EFD] focus:outline-none focus:ring-1 focus:ring-[#0D6EFD]"
                  placeholder="Ulangi password baru"
                />
              </div>

              {newPassword && confirm && newPassword !== confirm && (
                <p className="text-xs text-[#F5222D]">Password tidak cocok</p>
              )}

              <button
                type="submit"
                disabled={loading || !newPassword || newPassword !== confirm}
                className="w-full rounded-lg bg-[#0D6EFD] py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B5FD5] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#F7F9FC]">
        <div className="text-sm text-[#667085]">Memuat...</div>
      </div>
    }>
      <ResetPasswordInner />
    </Suspense>
  );
}
