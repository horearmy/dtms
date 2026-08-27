"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';

type SetupState = {
  enabled: boolean;
  secret?: string;
  otpauth?: string;
};

export default function SecurityPage() {
  const router = useRouter();
  const [state, setState] = useState<SetupState | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/auth/2fa/setup');
    if (res.status === 401) {
      router.push('/login');
      return;
    }
    const data = await res.json();
    setState(data);
    if (!data.enabled && data.otpauth) {
      const qr = await QRCode.toDataURL(data.otpauth, { width: 240, margin: 1 });
      setQrData(qr);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function enable(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Verifikasi gagal');
        setLoading(false);
        return;
      }
      setBackupCodes(data.backupCodes);
      setCode('');
      setLoading(false);
    } catch {
      setError('Terjadi kesalahan jaringan');
      setLoading(false);
    }
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal menonaktifkan 2FA');
        setLoading(false);
        return;
      }
      setInfo('2FA berhasil dinonaktifkan');
      setState({ enabled: false });
      setBackupCodes(null);
      setQrData(null);
      setCode('');
      setPassword('');
      setLoading(false);
    } catch {
      setError('Terjadi kesalahan jaringan');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] px-4 py-8">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-[#101828]">Keamanan Akun</h1>
          <Link href="/dashboard" className="text-xs font-semibold text-[#0D6EFD] underline">
            ← Kembali ke Dashboard
          </Link>
        </div>

        {backupCodes ? (
          <div className="rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h2 className="text-lg font-bold text-[#101828]">2FA Berhasil Diaktifkan</h2>
            <p className="mt-1 text-sm text-[#667085]">
              Simpan kode cadangan berikut di tempat aman. Setiap kode hanya bisa dipakai sekali.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {backupCodes.map((c) => (
                <code key={c} className="rounded-lg bg-[#F7F9FC] px-3 py-2 text-center text-sm font-bold tracking-wider text-[#101828]">
                  {c}
                </code>
              ))}
            </div>
            <button
              onClick={() => setBackupCodes(null)}
              className="mt-5 w-full rounded-lg bg-[#0D6EFD] py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B5FD5]"
            >
              Selesai
            </button>
          </div>
        ) : state?.enabled ? (
          <div className="rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <h2 className="text-lg font-bold text-[#101828]">Verifikasi 2 Langkah Aktif</h2>
            </div>
            <p className="mt-2 text-sm text-[#667085]">
              Login Anda dilindungi kode TOTP dari aplikasi autentikator.
            </p>
            <form onSubmit={disable} className="mt-5 space-y-3">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9A-Za-z-]/g, ''))}
                placeholder="Kode 2FA atau kode cadangan (opsional)"
                className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password akun (opsional)"
                className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none"
              />
              <p className="text-xs text-[#667085]">
                Isi salah satu (kode 2FA/cadangan <b className="text-[#101828]">atau</b> password) untuk konfirmasi.
              </p>
              {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#F5222D] py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {loading ? 'Memproses...' : 'Nonaktifkan 2FA'}
              </button>
            </form>
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h2 className="text-lg font-bold text-[#101828]">Aktifkan Verifikasi 2 Langkah</h2>
            <p className="mt-2 text-sm text-[#667085]">
              Gunakan aplikasi autentikator (Google Authenticator, Aegis, dll.) lalu ikuti langkah berikut:
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-[#101828]">
              <li>Buka aplikasi autentikator dan pindai kode QR di bawah.</li>
              <li>Masukkan kode 6 digit yang muncul.</li>
              <li>Simpan kode cadangan yang ditampilkan.</li>
            </ol>
            {info && <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</div>}
            <div className="mt-4 flex flex-col items-center gap-2">
              {qrData ? (
                <>
                  <img src={qrData} alt="QR 2FA" className="rounded-lg border border-[#E4E7EC]" />
                  {state?.secret && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(state.secret || '');
                        setInfo('Secret disalin ke clipboard');
                      }}
                      className="text-xs font-semibold text-[#0D6EFD] underline"
                    >
                      Salin kunci rahasia manual
                    </button>
                  )}
                </>
              ) : (
                <div className="text-sm text-[#667085]">Memuat QR...</div>
              )}
            </div>
            <form onSubmit={enable} className="mt-4 space-y-3">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Kode 6 digit"
                className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-center text-lg tracking-[0.5em] focus:border-[#0D6EFD] focus:outline-none"
              />
              {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#0D6EFD] py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B5FD5] disabled:opacity-60"
              >
                {loading ? 'Memproses...' : 'Verifikasi & Aktifkan'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
