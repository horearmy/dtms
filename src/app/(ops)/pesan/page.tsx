'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { formatDateTime } from '@/lib/constants';

type Message = {
  id: string;
  subject: string;
  body: string;
  senderId: string | null;
  senderName: string;
  direction: string;
  read: boolean;
  createdAt: string;
};

export default function PesanPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [form, setForm] = useState({ subject: '', body: '' });
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<Message | null>(null);
  const [success, setSuccess] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    const res = await fetch(`/api/messages?${params}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.items);
      setTotal(data.total);
      setUnreadCount(data.unreadCount);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  async function sendReply() {
    if (!form.subject || !form.body) return;
    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: form.subject, body: form.body }),
      });
      if (res.ok) {
        setForm({ subject: '', body: '' });
        setShowCompose(false);
        setSuccess('Pesan berhasil dikirim');
        setTimeout(() => setSuccess(''), 3000);
        load();
      }
    } catch {}
    setSending(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#101828]">Pesan</h1>
          <p className="text-sm text-[#667085]">
            {unreadCount > 0 ? `${unreadCount} pesan belum dibaca` : 'Semua pesan sudah dibaca'}
          </p>
        </div>
        <button
          onClick={() => setShowCompose(!showCompose)}
          className="rounded-lg bg-[#0D6EFD] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B5FD5]"
        >
          + Pesan Baru
        </button>
      </div>

      {success && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      )}

      {showCompose && (
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 space-y-3">
          <div className="text-sm font-bold text-[#101828]">Kirim Pesan ke Support</div>
          <input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Subjek pesan..."
            className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none"
          />
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Tulis pesan Anda..."
            rows={4}
            className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowCompose(false); setForm({ subject: '', body: '' }); }}
              className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-1.5 text-xs font-medium text-[#667085] hover:bg-[#F7F9FC]"
            >
              Batal
            </button>
            <button
              onClick={sendReply}
              disabled={sending || !form.subject || !form.body}
              className="rounded-lg bg-[#0D6EFD] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0B5FD5] disabled:opacity-50"
            >
              {sending ? 'Mengirim...' : 'Kirim'}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#E4E7EC] bg-white">
        {loading ? (
          <div className="py-10 text-center text-sm text-[#667085]">Memuat...</div>
        ) : messages.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#667085]">Belum ada pesan</div>
        ) : (
          <div className="divide-y divide-[#E4E7EC]">
            {messages.map((msg) => (
              <button
                key={msg.id}
                onClick={() => setSelected(selected?.id === msg.id ? null : msg)}
                className={`w-full px-4 py-3 text-left transition hover:bg-[#F7F9FC]/50 ${
                  !msg.read ? 'bg-[#0D6EFD]/[0.03]' : ''
                } ${selected?.id === msg.id ? 'bg-[#0D6EFD]/5' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {!msg.read && (
                      <span className="h-2 w-2 rounded-full bg-[#0D6EFD]" />
                    )}
                    <span className={`text-sm ${!msg.read ? 'font-bold' : 'font-medium'} text-[#101828]`}>
                      {msg.subject}
                    </span>
                    {msg.direction === 'OUTBOUND' && (
                      <span className="rounded-full bg-[#0D6EFD]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#0D6EFD]">Dari Admin</span>
                    )}
                  </div>
                  <span className="text-xs text-[#667085]">{formatDateTime(msg.createdAt)}</span>
                </div>
                {selected?.id === msg.id && (
                  <div className="mt-3 rounded-lg bg-[#F7F9FC] p-3">
                    <div className="whitespace-pre-wrap text-sm text-[#344054]">{msg.body}</div>
                    <div className="mt-2 text-[10px] text-[#667085]">Oleh: {msg.senderName}</div>
                  </div>
                )}
                {selected?.id !== msg.id && (
                  <div className="mt-1 truncate text-xs text-[#667085]">{msg.body.slice(0, 80)}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
