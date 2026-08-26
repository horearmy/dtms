'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { formatDateTime } from '@/lib/constants';

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
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
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

  const loadUnreadCounts = useCallback(async () => {
    const res = await fetch('/api/messages');
    if (res.ok) {
      const data = await res.json();
      if (data.unreadCounts) setUnreadCounts(data.unreadCounts);
    }
  }, []);

  useEffect(() => {
    fetch('/api/tenants')
      .then((r) => r.json())
      .then((data) => setTenants(Array.isArray(data) ? data : data.tenants || []));
    loadUnreadCounts();
  }, [loadUnreadCounts]);

  const markAsRead = useCallback(async (messageIds: string[]) => {
    if (!selectedTenant || messageIds.length === 0) return;
    const res = await fetch('/api/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: messageIds, tenantId: selectedTenant.id }),
    });
    if (res.ok) {
      setMessages((prev) => prev.map((m) => (messageIds.includes(m.id) ? { ...m, read: true } : m)));
      setUnreadCounts((prev) => ({ ...prev, [selectedTenant.id]: Math.max(0, (prev[selectedTenant.id] || 0) - messageIds.length) }));
    }
  }, [selectedTenant]);

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
      setUnreadCounts((prev) => ({ ...prev, [selectedTenant.id]: data.unreadCount || 0 }));
      const unreadIds = data.items
        .filter((m: Message) => m.direction === 'INBOUND' && !m.read)
        .map((m: Message) => m.id);
      if (unreadIds.length > 0) markAsRead(unreadIds);
    }
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [selectedTenant, page, markAsRead]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    const interval = setInterval(loadUnreadCounts, 30000);
    const onVisible = () => { if (!document.hidden) loadUnreadCounts(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadUnreadCounts]);

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
        loadUnreadCounts();
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
            {tenants.map((t) => {
              const count = unreadCounts[t.id] || 0;
              return (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTenant(t); setPage(1); setShowCompose(false); }}
                  className={`w-full border-b border-[#E4E7EC] px-4 py-3 text-left transition hover:bg-[#F7F9FC] last:border-0 ${
                    selectedTenant?.id === t.id ? 'bg-[#0D6EFD]/5 border-l-2 border-l-[#0D6EFD]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-[#101828]">{t.name}</div>
                    {count > 0 && (
                      <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white min-w-[18px] text-center">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#667085]">/{t.slug}</div>
                </button>
              );
            })}
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
                          : 'border-[#16B364]/20 bg-[#16B364]/5 mr-8'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#101828]">{msg.subject}</span>
                          {!msg.read && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              msg.direction === 'OUTBOUND'
                                ? 'bg-[#0D6EFD]/10 text-[#0D6EFD]'
                                : 'bg-[#16B364]/10 text-[#16B364]'
                            }`}>Baru</span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#667085]">{formatDateTime(msg.createdAt)}</span>
                      </div>
                      <div className="whitespace-pre-wrap text-sm text-[#344054]">{msg.body}</div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-[#667085]">
                          {msg.direction === 'OUTBOUND' ? 'Dikirim ke tenant' : 'Dari tenant'} · {msg.senderName}
                        </span>
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
