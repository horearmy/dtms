'use client';

import { useEffect, useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';

type Notification = {
  id: string;
  message: string;
  status: string;
  createdAt: string;
  shipment?: { trackingNumber: string } | null;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/notifications?pageSize=50')
      .then((r) => r.json())
      .then((data) => setNotifications(data.items || data.notifications || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function markAllRead() {
    await fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: notifications.filter(n => n.status === 'UNREAD').map(n => n.id) }) });
    setNotifications(prev => prev.map(n => ({ ...n, status: 'READ' })));
  }

  if (loading) return <div className="py-8 text-center text-gray-500">Memuat...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Notifikasi</h2>
        {notifications.some(n => n.status === 'UNREAD') && (
          <button onClick={markAllRead} className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100">
            <CheckCheck size={14} /> Tandai semua dibaca
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
          <Bell size={32} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-400">Belum ada notifikasi</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {notifications.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 px-4 py-3 ${n.status === 'UNREAD' ? 'bg-blue-50/50' : ''}`}>
              <div className="mt-0.5">
                {n.status === 'UNREAD' ? <Bell size={16} className="text-blue-500" /> : <Check size={16} className="text-gray-300" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">{n.message}</p>
                {n.shipment && <p className="mt-0.5 text-xs text-gray-400">#{n.shipment.trackingNumber}</p>}
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(n.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
