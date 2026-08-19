'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { formatDateTime } from '@/lib/constants';
import { EmptyRow } from '@/components/ui';

type Tenant = { id: string; name: string; slug: string; status: string; active: boolean };
type Message = {
  id: string;
  subject: string;
  body: string;
  senderId: string | null;
  senderName: string;
  direction: string;
  read: boolean;
  createdAt: string;
  tenant: { id: string; name: string; slug: string };
};

export default function KomunikasiPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [form, setForm] = useState({ subject: '', body: '' });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const pageSize = 50;

  useEffect(() => {
    fetch('/api/tenants')
      .then((r) => r.json())
      .then((data) => setTenants(Array.isArray(data) ? data : data.items || []));
  }, []);

  const loadMessages = useCallback(async () => {
    if (!selectedTenant) return;
    setLoading(true);
    const params = new URLSearchParams({
      tenantId: selectedTenant.id,
      page: String(page),
      pageSize: String(pageSize),
    });
    const res = await fetch(`/api/messages?${params}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.items);
      setTotal(data.total);
    }
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [selectedTenant, page]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  async function sendMessage() {
    if (!selectedTenant || !form.subject || !form.body) return;
    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: selectedTenant.id,
          subject: form.subject,
          body: form.body,
          direction: 'OUTBOUND',
        }),
      });
      if (res.ok) {
        setForm({ subject: '', body: '' });
        setShowCompose(false);
        setSuccess(`Pesan berhasil dikirim ke ${selectedTenant.name}`);
        setTimeout(() => setSuccess(''), 3000);
        loadMessages();
      } else {
        const data = await res.json();
        setError(data.error || 'Gagal mengirim pesan');
        setTimeout(() => setError(''), 3000);
      }
    } catch {
      setError('Terjadi kesalahan jaringan');
      setTimeout(() => setError(''), 3000);
    }
    setSending(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#101828]">Komunikasi</h1>
        <p className="text-sm text-[#667085]">Kirim pesan dan informasi ke tenant</p>
      </div>

      {success && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* Tenant List */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white">
          <div className="border-b border-[#E4E7EC] px-4 py-3">
            <h2 className="text-sm font-bold text-[#101828]">Pilih Tenant</h2>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {tenants.map((t) => (
              <button
                key={t.id}
                onClick={() => { setSelectedTenant(t); setPage(1); setShowCompose(false); }}
                className={`w-full border-b border-[#E4E7EC] px-4 py-3 text-left transition hover:bg-[#F7F9FC] last:border-0 ${
                  selectedTenant?.id === t.id ? 'bg-[#0D6EFD]/5 border-l-2 border-l-[#0D6EFD]' : ''
                }`}
              >
                <div className="text-sm font-medium text-[#101828]">{t.name}</div>
                <div className="text-xs text-[#667085]">/{t.slug}</div>
              </button>
            ))}
            {tenants.length === 0 && (
              <div className="py-10 text-center text-sm text-[#667085]">Tidak ada tenant</div>
            )}
          </div>
        </div>

        {/* Message Area */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white">
          {!selectedTenant ? (
            <div className="flex h-[600px] items-center justify-center text-sm text-[#667085]">
              Pilih tenant di sebelah kiri untuk mulai berkomunikasi
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#E4E7EC] px-4 py-3">
                <div>
                  <h2 className="text-sm font-bold text-[#101828]">{selectedTenant.name}</h2>
                  <div className="text-xs text-[#667085]">/{selectedTenant.slug}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setForm({
                        subject: 'Akun DTMS Anda Telah Aktif',
                        body: `Halo,\n\nAkun DTMS untuk ${selectedTenant.name} telah berhasil dibuat.\n\nDetail Akun:\nURL: (masukkan URL login)\nUsername: (masukkan username)\nPassword: (masukkan password)\n\nSilakan login dan segera ganti password Anda.\n\nTerima kasih.`,
                      });
                      setShowCompose(true);
                    }}
                    disabled={sending}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Kirim Kredensial
                  </button>
                  <button
                    onClick={() => setShowCompose(!showCompose)}
                    className="rounded-lg bg-[#0D6EFD] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0B5FD5]"
                  >
                    + Pesan Baru
                  </button>
                </div>
              </div>

              {/* Compose Form */}
              {showCompose && (
                <div className="border-b border-[#E4E7EC] bg-[#F7F9FC] p-4 space-y-3">
                  <input
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Subjek pesan..."
                    className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none"
                  />
                  <textarea
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    placeholder="Tulis pesan..."
                    rows={4}
                    className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setShowCompose(false); setForm({ subject: '', body: '' }); }}
                      className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-1.5 text-xs font-medium text-[#667085] hover:bg-[#F7F9FC]"
                    >
                      Batal
                    </button>
                    <button
                      onClick={sendMessage}
                      disabled={sending || !form.subject || !form.body}
                      className="rounded-lg bg-[#0D6EFD] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0B5FD5] disabled:opacity-50"
                    >
                      {sending ? 'Mengirim...' : 'Kirim'}
                    </button>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="max-h-[500px] overflow-y-auto p-4 space-y-3">
                {loading ? (
                  <div className="py-10 text-center text-sm text-[#667085]">Memuat...</div>
                ) : messages.length === 0 ? (
                  <div className="py-10 text-center text-sm text-[#667085]">Belum ada pesan</div>
                ) : (
                  [...messages].reverse().map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-lg border p-3 ${
                        msg.direction === 'OUTBOUND'
                          ? 'border-[#0D6EFD]/20 bg-[#0D6EFD]/5 ml-8'
                          : 'border-[#E4E7EC] bg-[#F7F9FC] mr-8'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#101828]">{msg.subject}</span>
                        <span className="text-[10px] text-[#667085]">{formatDateTime(msg.createdAt)}</span>
                      </div>
                      <div className="whitespace-pre-wrap text-sm text-[#344054]">{msg.body}</div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-[#667085]">
                          {msg.direction === 'OUTBOUND' ? 'Dikirim ke tenant' : 'Dari tenant'} · {msg.senderName}
                        </span>
                        {!msg.read && msg.direction === 'OUTBOUND' && (
                          <span className="rounded-full bg-[#0D6EFD]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#0D6EFD]">Baru</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
