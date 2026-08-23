'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Key, Lock, Eye, EyeOff, AlertTriangle, CheckCircle } from 'lucide-react';

type Step = 'secret' | 'credentials';

export default function SecureLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('secret');
  const [secretKey, setSecretKey] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastLoginInfo, setLastLoginInfo] = useState<{ time: string; ip: string } | null>(null);

  const handleSecretKey = async (e: FormEvent) => {
    e.preventDefault();
    if (!secretKey.trim()) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/superadmin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 1, secretKey: secretKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Secret key salah');
        return;
      }
      setSessionToken(data.sessionToken);
      setStep('credentials');
    } catch { setError('Koneksi gagal'); }
    finally { setLoading(false); }
  };

  const handleCredentials = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError('');
    setLoading(true);
    try {
      const fp = await navigator.userAgent;
      const res = await fetch('/api/auth/superadmin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 2, sessionToken, username: username.trim(), password, fingerprint: fp }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 && data.error?.includes('awal')) {
          setStep('secret');
          setSecretKey('');
          setSessionToken('');
        }
        setError(data.error || 'Login gagal');
        return;
      }
      setLastLoginInfo({ time: new Date().toLocaleString('id-ID'), ip: 'Authenticated' });
      router.push('/tenants');
    } catch { setError('Koneksi gagal'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-900/30 border-2 border-red-500/50">
            <Shield className="h-10 w-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">SUPERADMIN</h1>
          <p className="mt-1 text-sm text-gray-400">Secure Access Portal</p>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-yellow-500">
            <AlertTriangle className="h-3 w-3" />
            <span>Area terbatas — semua aktivitas dicatat</span>
          </div>
        </div>

        {step === 'secret' && (
          <form onSubmit={handleSecretKey} className="space-y-5">
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-300">
                <Key className="h-4 w-4" />
                Secret Access Key
              </label>
              <input
                type="password"
                value={secretKey}
                onChange={e => setSecretKey(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3 text-white placeholder-gray-500 outline-none transition focus:border-red-500 focus:ring-1 focus:ring-red-500"
                placeholder="Masukkan secret key"
                autoFocus
              />
            </div>
            {error && (
              <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !secretKey.trim()}
              className="w-full rounded-lg bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Memverifikasi...' : 'Verifikasi Secret Key'}
            </button>
          </form>
        )}

        {step === 'credentials' && (
          <form onSubmit={handleCredentials} className="space-y-5">
            <div className="rounded-lg border border-green-800 bg-green-900/20 p-3 text-center text-sm text-green-400">
              <CheckCircle className="mx-auto mb-1 h-4 w-4" />
              Secret key terverifikasi
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3 text-white placeholder-gray-500 outline-none transition focus:border-red-500 focus:ring-1 focus:ring-red-500"
                placeholder="Username superadmin"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3 pr-12 text-white placeholder-gray-500 outline-none transition focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  placeholder="Password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && (
              <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full rounded-lg bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Lock className="h-4 w-4 animate-pulse" />
                  Memverifikasi...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Lock className="h-4 w-4" />
                  Masuk ke Dashboard
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => { setStep('secret'); setSecretKey(''); setSessionToken(''); setError(''); }}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-300"
            >
              Kembali
            </button>
          </form>
        )}

        {lastLoginInfo && (
          <div className="mt-6 rounded-lg border border-gray-800 bg-gray-900/50 p-3 text-xs text-gray-500">
            <p>Login terakhir: {lastLoginInfo.time}</p>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-gray-600">
          <p>DTMS Superadmin Secure Portal</p>
          <p className="mt-1">Sesi berakhir dalam 4 jam</p>
        </div>
      </div>
    </div>
  );
}
