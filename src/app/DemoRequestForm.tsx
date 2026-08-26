"use client";

import { useEffect, useState } from 'react';
import CountryCodeSelect, { detectDial, validatePhone, toE164 } from '@/components/CountryCodeSelect';

export default function DemoRequestForm() {
  const [dial, setDial] = useState('+62');
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', message: '' });
  const [phoneError, setPhoneError] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    setDial(detectDial());
  }, []);

  function setPhone(raw: string) {
    const digits = raw.replace(/\D/g, '');
    setForm({ ...form, phone: digits });
    setPhoneError('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.phone) {
      const err = validatePhone(dial, form.phone);
      if (err) {
        setPhoneError(err);
        return;
      }
    }
    setStatus('loading');
    setError('');
    try {
      const res = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, phone: form.phone ? toE164(dial, form.phone) : '' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal mengirim');
        setStatus('error');
        return;
      }
      setStatus('success');
    } catch {
      setError('Terjadi kesalahan jaringan');
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-green-900">Terima Kasih!</h3>
        <p className="mt-2 text-sm text-green-700">
          Tim kami akan menghubungi Anda dalam 1×24 jam untuk demo personal.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-gray-100 bg-white p-8 shadow-lg">
      <h3 className="text-lg font-bold text-gray-900">Formulir Demo</h3>
      <p className="mt-1 text-sm text-gray-500">Isi data Anda di bawah ini.</p>
      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nama Lengkap *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2.5 text-sm focus:border-[#0D6EFD] focus:outline-none"
            placeholder="John Doe"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2.5 text-sm focus:border-[#0D6EFD] focus:outline-none"
            placeholder="john@perusahaan.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Telepon</label>
          <div className="flex gap-2">
            <CountryCodeSelect value={dial} onChange={setDial} />
            <input
              type="tel"
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:border-[#0D6EFD] focus:outline-none ${phoneError ? 'border-red-400' : 'border-[#E4E7EC]'}`}
              placeholder="8123456789"
            />
          </div>
          {phoneError && <p className="mt-1 text-xs text-red-600">{phoneError}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nama Perusahaan *</label>
          <input
            type="text"
            required
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2.5 text-sm focus:border-[#0D6EFD] focus:outline-none"
            placeholder="PT Logistik Jaya"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Pesan (opsional)</label>
          <textarea
            rows={3}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2.5 text-sm focus:border-[#0D6EFD] focus:outline-none"
            placeholder="Ceritakan kebutuhan logistik Anda..."
          />
        </div>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full rounded-xl bg-[#0D6EFD] py-3 text-sm font-bold text-white transition hover:bg-[#0B5FD5] disabled:opacity-60"
        >
          {status === 'loading' ? 'Mengirim...' : 'Kirim & Minta Demo'}
        </button>
      </div>
    </form>
  );
}
