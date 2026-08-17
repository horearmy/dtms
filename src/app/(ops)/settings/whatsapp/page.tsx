"use client";

import { useState, useEffect } from 'react';
import { inputCls, btnPrimary, btnGhost, Field } from '@/components/ui';

type WhatsAppConfig = {
  enabled: boolean;
  configured: boolean;
  phoneNumberId: string;
  businessAccountId: string;
  adminNumbers: string[];
};

export default function WhatsAppSettingsPage() {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [testPhone, setTestPhone] = useState('');
  const [testMsg, setTestMsg] = useState('Test dari DTMS WhatsApp Integration');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');

  async function load() {
    setLoading(true);
    const res = await fetch('/api/whatsapp/send');
    if (res.ok) setConfig(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function sendTest(e: React.FormEvent) {
    e.preventDefault();
    if (!testPhone) return;
    setSending(true);
    setResult('');
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: testPhone, message: testMsg }),
    });
    const data = await res.json();
    if (res.ok) {
      setResult('✓ Pesan berhasil dikirim!');
    } else {
      setResult(`✗ Gagal: ${data.error || 'Unknown error'}`);
    }
    setSending(false);
  }

  if (loading) return <div className="py-20 text-center text-slate-400">Memuat...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900">WhatsApp Business Integration</h1>
        <p className="text-sm text-slate-500">Konfigurasi notifikasi WhatsApp menggunakan WhatsApp Business Cloud API (Meta).</p>
      </div>

      <div className={`rounded-xl border p-5 ${config?.enabled ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${config?.enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2A10 10 0 002 12a9.9 9.9 0 002.3 6.4L3 22l3.8-1.2A9.9 9.9 0 0012 22h.1A10 10 0 0012 2zm5.6 14.2c-.2.6-1.2 1.2-1.7 1.2-.4.1-.9.1-1.5-.1-2.2-.8-4.1-2.5-5.4-4.9-.4-.7-.7-1.5-.7-1.9 0-.5.2-.9.5-1.3.2-.3.4-.5.6-.7.2-.1.3-.1.4-.1h.4c.1 0 .3-.1.5.4l.7 1.6c.1.2.1.4 0 .6l-.4.6c-.1.2-.2.4 0 .6.4.6 1 1.2 1.5 1.6.2.2.4.3.6.1.1-.2.4-.4.6-.7.2-.2.4-.2.6-.1l1.6.8c.2.1.4.3.5.4.1.2.1.3 0 .6z"/></svg>
          </div>
          <div>
            <div className="font-semibold text-slate-900">
              Status: {config?.enabled ? 'Aktif' : 'Non-aktif'}
            </div>
            <div className="text-sm text-slate-500">
              {config?.configured ? 'API sudah dikonfigurasi' : 'API belum dikonfigurasi'}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-slate-900">Cara Setup WhatsApp Business API</h2>
        <ol className="space-y-3 text-sm text-slate-600">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">1</span>
            <div>
              <b>Buka Meta Business Suite</b>
              <p className="text-xs text-slate-400">https://business.facebook.com → WhatsApp → Getting Started</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">2</span>
            <div>
              <b>Generate Permanent Access Token</b>
              <p className="text-xs text-slate-400">Buat System User → Generate Token → Scope: whatsapp_business_messaging</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">3</span>
            <div>
              <b>Isi environment variables di .env</b>
              <div className="mt-1 rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-700">
                <div>WHATSAPP_ENABLED=&quot;true&quot;</div>
                <div>WHATSAPP_API_TOKEN=&quot;your-permanent-token&quot;</div>
                <div>WHATSAPP_PHONE_NUMBER_ID=&quot;from-dashboard&quot;</div>
                <div>WHATSAPP_BUSINESS_ACCOUNT_ID=&quot;from-dashboard&quot;</div>
                <div>WHATSAPP_ADMIN_NUMBERS=&quot;628xxxxxxxxxx&quot;</div>
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">4</span>
            <div>
              <b>Daftarkan nomor telepon</b>
              <p className="text-xs text-slate-400">Gunakan nomor yang belum terdaftar di WhatsApp biasa, atau migrasi ke WhatsApp Business</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">5</span>
            <div>
              <b>Set webhook (opsional)</b>
              <p className="text-xs text-slate-400">Webhook URL: {process.env.APP_URL || 'your-app-url'}/api/whatsapp/webhook</p>
            </div>
          </li>
        </ol>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-slate-900">Kirim Pesan Test</h2>
        <form onSubmit={sendTest} className="space-y-4">
          <Field label="Nomor Tujuan (format: 628xxxxxxxxxx)">
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="628123456789"
              className={inputCls}
              required
            />
          </Field>
          <Field label="Pesan">
            <textarea
              value={testMsg}
              onChange={(e) => setTestMsg(e.target.value)}
              className={inputCls}
              rows={3}
            />
          </Field>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={sending || !config?.configured} className={btnPrimary}>
              {sending ? 'Mengirim...' : 'Kirim Test'}
            </button>
            {!config?.configured && (
              <span className="text-xs text-amber-600">Konfigurasi API terlebih dahulu</span>
            )}
          </div>
          {result && (
            <div className={`text-sm font-semibold ${result.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}>
              {result}
            </div>
          )}
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-slate-900">Notifikasi Otomatis</h2>
        <p className="mb-3 text-sm text-slate-500">
          WhatsApp akan otomatis mengirim pesan ke penerima saat status shipment berubah.
        </p>
        <div className="space-y-2">
          {[
            { event: 'Status Shipment Update', desc: 'Pesan ke penerima saat status berubah (disampaikan ke penerima)' },
            { event: 'SLA Terlambat', desc: 'Alert ke admin saat SLA breached' },
            { event: 'GPS Driver Terputus', desc: 'Alert ke admin saat GPS driver offline >30 menit' },
            { event: 'Pengiriman Gagal', desc: 'Alert ke admin saat delivery failed' },
          ].map((item) => (
            <div key={item.event} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">{item.event}</div>
                <div className="text-xs text-slate-400">{item.desc}</div>
              </div>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-slate-900">Catatan Penting</h2>
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex gap-2">
            <span className="text-amber-500">•</span>
            <span>WhatsApp Business Cloud API memberikan <b>1000 pesan gratis/bulan</b> (service conversation). Setelah itu dikenakan biaya.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-500">•</span>
            <span>Pesan hanya bisa dikirim ke nomor yang pernah mengirim pesan ke bisnis Anda terlebih dahulu (24-hour window), atau menggunakan template yang sudah di-approve Meta.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-500">•</span>
            <span>Untuk pengiriman pertama ke nomor baru, buat template pesan di Meta Business Suite → WhatsApp → Message Templates.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-500">•</span>
            <span>DTMS menggunakan text message (bukan template) karena shipment tracking notification dianggap transactional.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
