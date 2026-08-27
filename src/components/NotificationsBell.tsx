'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';

type Notif = {
  id: string;
  message: string;
  shipmentId: string | null;
  createdAt: string;
  status: string;
  metadata?: unknown;
};

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function notifHref(n: Notif): string | null {
  if (n.shipmentId) return `/shipments/${n.shipmentId}`;
  const md = (n.metadata && typeof n.metadata === 'object' ? n.metadata : {}) as Record<string, unknown>;
  if (md.type === 'message' && typeof md.tenantId === 'string') {
    return `/komunikasi?tenant=${md.tenantId}`;
  }
  if (md.type === 'demo_request') return '/demo-requests';
  // Fallback untuk notifikasi lama (tanpa metadata): parse dari teks
  if (n.message.startsWith('[Pesan]')) {
    const m = n.message.match(UUID_RE);
    if (m) return `/komunikasi?tenant=${m[0]}`;
    return '/komunikasi';
  }
  if (n.message.startsWith('Permohonan Demo')) return '/demo-requests';
  return null;
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setUnread(data.unread || 0);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  async function markRead(ids?: string[]) {
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids ? { ids } : {}),
      });
      setUnread((u) => (ids ? Math.max(0, u - ids.length) : 0));
      setItems((prev) => prev.map((i) => (!ids || ids.includes(i.id) ? { ...i, status: 'READ' } : i)));
    } catch { /* silent */ }
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen((wasOpen) => {
          if (wasOpen && unread > 0) markRead();
          return false;
        });
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
     
  }, [unread]);

  function onItemClick(n: Notif) {
    markRead([n.id]);
    setOpen(false);
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && unread > 0) markRead();
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
            {items.map((n) => {
              const href = notifHref(n);
              const inner = (
                <>
                  <div className={`text-sm ${n.status === 'UNREAD' ? 'font-semibold text-[#101828]' : 'text-[#344054]'}`}>{n.message}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[11px] text-[#667085]">
                      {new Date(n.createdAt).toLocaleString('id-ID')}
                    </span>
                    {href && <span className="text-[11px] font-medium text-[#0D6EFD]">Lihat →</span>}
                  </div>
                </>
              );
              const cls = `block px-4 py-3 hover:bg-[#F7F9FC] ${n.status === 'UNREAD' ? 'bg-[#0D6EFD]/[0.03]' : ''}`;
              return (
                <div key={n.id} className="border-b border-[#E4E7EC] last:border-0">
                  {href ? (
                    <Link href={href} onClick={() => onItemClick(n)} className={cls}>
                      {inner}
                    </Link>
                  ) : (
                    <div className="px-4 py-3">{inner}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
