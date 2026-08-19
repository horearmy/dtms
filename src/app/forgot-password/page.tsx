'use client';

import { useState } from 'react';
import { Package } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json();
      setResult({ ok: data.ok, message: data.message });
    } catch {
      setResult({ ok: false, message: 'Terjadi kesalahan jaringan' });
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F9FC] px-4">
      <div className="w-full max-w-[400px]">
        <div className="rounded-2xl border border-[#E4E7EC] bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0D6EFD]">
              <Package size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-[#101828]">Lupa Password</h1>
            <p className="mt-0.5 text-sm text-[#667085]">
              Masukkan username atau nomor telepon Anda
            </p>
          </div>

          {result ? (
            <div className="space-y-4">
              <div className={`rounded-lg px-3 py-2 text-sm ${result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F5222D]/10 text-[#F5222D]'}`}>
                {result.message}
              </div>
              <Link
                href="/login"
                className="block w-full text-center text-sm font-semibold text-[#0D6EFD] underline hover:text-[#0B5FD5]"
              >
                &larr; Kembali ke login
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#101828]">Username / Telepon</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoFocus
                  className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2.5 text-sm text-[#101828] placeholder:text-[#667085] focus:border-[#0D6EFD] focus:outline-none focus:ring-1 focus:ring-[#0D6EFD]"
                  placeholder="mis. budi atau 081234567890"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !identifier.trim()}
                className="w-full rounded-lg bg-[#0D6EFD] py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B5FD5] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Mengirim...' : 'Kirim Instruksi Reset'}
              </button>

              <Link
                href="/login"
                className="block w-full text-center text-xs font-semibold text-[#667085] underline hover:text-[#101828]"
              >
                &larr; Kembali ke login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
