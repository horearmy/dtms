'use client';

import { useCallback, useEffect, useState } from 'react';
import { Fingerprint, Plus, Trash2 } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';

type PasskeyRow = {
  id: string;
  deviceName: string;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
};

export default function PasskeysPanel() {
  const [items, setItems] = useState<PasskeyRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/auth/passkey');
      if (res.ok) setItems((await res.json()).items || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function register() {
    setMsg(null);
    setBusy(true);
    try {
      const name = prompt('Beri nama perangkat ini (mis. MacBook Kerja):');
      if (name === null) return;

      const startRes = await fetch('/api/admin/auth/passkey/register/start', { method: 'POST' });
      if (!startRes.ok) throw new Error((await startRes.json().catch(() => ({}))).error || 'Gagal memulai pendaftaran');
      const { options, challenge } = await startRes.json();

      // Seremoni WebAuthn di browser (Touch ID / Windows Hello / security key)
      let attestation;
      try {
        attestation = await startRegistration({ optionsJSON: options });
      } catch (e) {
        throw new Error('Dibatalkan atau authenticator tidak tersedia');
      }

      const verifyRes = await fetch('/api/admin/auth/passkey/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge, response: attestation, deviceName: name || 'Passkey' }),
      });
      const data = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) throw new Error(data.error || 'Verifikasi gagal');

      setMsg({ ok: true, text: 'Passkey terdaftar.' });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Gagal mendaftarkan passkey' });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Hapus passkey ini?')) return;
    const res = await fetch(`/api/admin/auth/passkey?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setItems((prev) => prev.filter((p) => p.id !== id));
      setMsg({ ok: true, text: 'Passkey dihapus.' });
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
      <div className="flex items-center justify-between border-b border-[#E4E7EC] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold text-[#101828]">
          <Fingerprint size={15} /> Passkeys
        </div>
        <button
          onClick={register}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D6EFD] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0B5FD5] disabled:opacity-50"
        >
          <Plus size={14} /> {busy ? 'Memproses…' : 'Daftarkan Passkey'}
        </button>
      </div>

      {msg && (
        <div className={`px-4 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {msg.text}
        </div>
      )}

      {items.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-[#667085]">
          Belum ada passkey. Daftarkan untuk login tanpa password (phishing-resistant).
        </div>
      ) : (
        <ul className="divide-y divide-[#E4E7EC]">
          {items.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-sm font-medium text-[#101828]">{p.deviceName}</div>
                <div className="mt-0.5 text-xs text-[#667085]">
                  Didaftar {new Date(p.createdAt).toLocaleDateString('id-ID')}
                  {p.lastUsedAt ? ` · Terakhir dipakai ${new Date(p.lastUsedAt).toLocaleString('id-ID')}` : ''}
                  {p.transports?.length ? ` · ${p.transports.join(', ')}` : ''}
                </div>
              </div>
              <button
                onClick={() => remove(p.id)}
                title="Hapus passkey"
                className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
