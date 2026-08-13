"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Notif = { id: string; message: string; shipmentId: string | null; createdAt: string; status: string };

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);

  async function load() {
    const res = await fetch('/api/notifications');
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
      setUnread(data.unread || 0);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  async function markRead() {
    await fetch('/api/notifications/read', { method: 'POST' });
    setUnread(0);
    setItems(items.map((i) => ({ ...i, status: 'READ' })));
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) markRead();
        }}
        className="relative rounded-lg bg-white/10 px-2.5 py-2 text-white transition hover:bg-white/20"
        aria-label="Notifikasi"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="px-2 py-1 text-xs font-bold uppercase text-slate-500">Notifikasi</div>
          {items.length === 0 && <div className="px-2 py-4 text-center text-sm text-slate-400">Tidak ada notifikasi</div>}
          <div className="max-h-80 overflow-y-auto">
            {items.map((n) => (
              <div key={n.id} className="rounded-lg px-2 py-2 hover:bg-slate-50">
                {n.shipmentId ? (
                  <Link href={`/shipments/${n.shipmentId}`} className="text-sm text-slate-700">
                    {n.message}
                  </Link>
                ) : (
                  <div className="text-sm text-slate-700">{n.message}</div>
                )}
                <div className="text-[11px] text-slate-400">{new Date(n.createdAt).toLocaleString('id-ID')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}