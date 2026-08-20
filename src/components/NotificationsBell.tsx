'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';

type Notif = { id: string; message: string; shipmentId: string | null; createdAt: string; status: string };

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);

  async function load() {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setUnread(data.unread || 0);
      }
    } catch { /* silent */ }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  async function markRead() {
    try {
      await fetch('/api/notifications/read', { method: 'POST' });
      setUnread(0);
      setItems(items.map((i) => ({ ...i, status: 'READ' })));
    } catch { /* silent */ }
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) markRead();
        }}
        className="relative rounded-lg p-2 text-[#667085] hover:bg-gray-100"
        aria-label="Notifikasi"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F5222D] px-1 text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-[#E4E7EC] bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-[#E4E7EC] px-4 py-3">
            <span className="text-sm font-semibold text-[#101828]">Notifikasi</span>
            <span className="text-xs text-[#667085]">{items.length} pesan</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <div className="py-8 text-center text-sm text-[#667085]">Tidak ada notifikasi</div>
            )}
            {items.map((n) => (
              <div key={n.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]">
                {n.shipmentId ? (
                  <Link
                    href={`/shipments/${n.shipmentId}`}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3"
                  >
                    <div className="text-sm text-[#101828]">{n.message}</div>
                    <div className="mt-1 text-[11px] text-[#667085]">
                      {new Date(n.createdAt).toLocaleString('id-ID')}
                    </div>
                  </Link>
                ) : (
                  <div className="px-4 py-3">
                    <div className="text-sm text-[#101828]">{n.message}</div>
                    <div className="mt-1 text-[11px] text-[#667085]">
                      {new Date(n.createdAt).toLocaleString('id-ID')}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
