'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Phone, Package, Camera, CheckCircle, XCircle, Navigation } from 'lucide-react';

type TaskDetail = {
  id: string;
  trackingNumber: string;
  destination: string;
  destAddress: string | null;
  destLat: number | null;
  destLng: number | null;
  receiverName: string | null;
  receiverPhone: string | null;
  status: string;
  assignedAt: string;
  vehicleNumber: string | null;
  items: { name: string; quantity: number; weight: number | null }[];
  originAddress: string;
};

type OfflineAction = {
  localId: string;
  type: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  synced: boolean;
};

export default function DriverTaskDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [gpsStatus, setGpsStatus] = useState<'off' | 'active' | 'error'>('off');
  const [offlineActions, setOfflineActions] = useState<OfflineAction[]>([]);
  const [showPod, setShowPod] = useState(false);
  const [podData, setPodData] = useState({ recipientName: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTask();
    loadOfflineQueue();
  }, [id]);

  const fetchTask = async () => {
    try {
      const res = await fetch(`/api/driver/tasks/${id}`);
      if (res.ok) {
        const data = await res.json();
        setTask(data);
        localStorage.setItem(`task_${id}`, JSON.stringify(data));
      }
    } catch {
      // offline — use cache
      const cached = localStorage.getItem(`task_${id}`);
      if (cached) setTask(JSON.parse(cached));
    }
    setLoading(false);
  };

  const loadOfflineQueue = () => {
    const queue = localStorage.getItem('offline_actions');
    if (queue) setOfflineActions(JSON.parse(queue));
  };

  const saveOfflineAction = (action: OfflineAction) => {
    const updated = [...offlineActions, action];
    setOfflineActions(updated);
    localStorage.setItem('offline_actions', JSON.stringify(updated));
  };

  // GPS Tracking
  const startGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsStatus('active');
        const point = {
          driverId: task?.id,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          accuracy: pos.coords.accuracy,
          timestamp: new Date().toISOString(),
        };

        // Try to send online
        fetch('/api/tracking/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points: [point] }),
        }).catch(() => {
          // offline — save to queue
          saveOfflineAction({
            localId: `gps_${Date.now()}`,
            type: 'GPS_POINT',
            payload: point,
            occurredAt: new Date().toISOString(),
            synced: false,
          });
        });
      },
      () => setGpsStatus('error'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [task]);

  useEffect(() => {
    const cleanup = startGps();
    return cleanup;
  }, [startGps]);

  // Sync offline queue
  const syncOffline = async () => {
    const unsynced = offlineActions.filter((a) => !a.synced);
    if (unsynced.length === 0) return;

    try {
      const res = await fetch('/api/driver/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions: unsynced }),
      });
      if (res.ok) {
        const updated = offlineActions.map((a) => ({ ...a, synced: true }));
        setOfflineActions(updated);
        localStorage.setItem('offline_actions', JSON.stringify(updated));
      }
    } catch {
      // still offline
    }
  };

  // Start delivery
  const startDelivery = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/driver/tasks/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'START' }),
      });
      if (res.ok) fetchTask();
    } catch {
      saveOfflineAction({
        localId: `action_${Date.now()}`,
        type: 'STATUS_UPDATE',
        payload: { shipmentId: id, action: 'START' },
        occurredAt: new Date().toISOString(),
        synced: false,
      });
      fetchTask();
    }
    setSubmitting(false);
  };

  // Submit POD
  const submitPod = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/driver/tasks/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'POD',
          recipientName: podData.recipientName,
          notes: podData.notes,
        }),
      });
      if (res.ok) {
        setShowPod(false);
        fetchTask();
      }
    } catch {
      saveOfflineAction({
        localId: `pod_${Date.now()}`,
        type: 'POD',
        payload: { shipmentId: id, ...podData },
        occurredAt: new Date().toISOString(),
        synced: false,
      });
      setShowPod(false);
      fetchTask();
    }
    setSubmitting(false);
  };

  // Mark failed
  const markFailed = async (reason: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/driver/tasks/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'FAIL', reason }),
      });
      if (res.ok) fetchTask();
    } catch {
      saveOfflineAction({
        localId: `fail_${Date.now()}`,
        type: 'STATUS_UPDATE',
        payload: { shipmentId: id, action: 'FAIL', reason },
        occurredAt: new Date().toISOString(),
        synced: false,
      });
      fetchTask();
    }
    setSubmitting(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-500">Memuat...</div>;
  if (!task) return <div className="flex items-center justify-center min-h-screen text-gray-500">Tugas tidak ditemukan</div>;

  const unsyncedCount = offlineActions.filter((a) => !a.synced).length;
  const isDispatched = task.status === 'DISPATCHED';
  const isTransit = task.status === 'IN_TRANSIT';
  const isDelivered = task.status === 'DELIVERED';

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="rounded-full p-2 hover:bg-gray-200">
          <ArrowLeft size={20} />
        </button>
        <div>
          <div className="font-mono text-sm font-semibold text-blue-600">{task.trackingNumber}</div>
          <StatusBadge status={task.status} />
        </div>
      </div>

      {/* Status Bar */}
      <div className="mb-4 flex items-center gap-2 text-xs">
        <span className={`flex items-center gap-1 rounded-full px-2 py-1 ${gpsStatus === 'active' ? 'bg-green-50 text-green-600' : gpsStatus === 'error' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
          <Navigation size={12} /> GPS {gpsStatus === 'active' ? 'Aktif' : gpsStatus === 'error' ? 'Error' : 'Mati'}
        </span>
        {unsyncedCount > 0 && (
          <button onClick={syncOffline} className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-600">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> {unsyncedCount} offline
          </button>
        )}
      </div>

      {/* Destination */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
          <MapPin size={16} /> Tujuan
        </div>
        <div className="text-sm text-gray-600">{task.destination}</div>
        {task.destAddress && <div className="mt-1 text-xs text-gray-400">{task.destAddress}</div>}
        {task.destLat && task.destLng && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${task.destLat},${task.destLng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <Navigation size={12} /> Buka di Maps
          </a>
        )}
      </div>

      {/* Receiver */}
      {task.receiverName && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 text-sm font-semibold text-gray-700">Penerima</div>
          <div className="text-sm text-gray-600">{task.receiverName}</div>
          {task.receiverPhone && (
            <a href={`tel:${task.receiverPhone}`} className="mt-1 flex items-center gap-1 text-xs text-blue-600">
              <Phone size={12} /> {task.receiverPhone}
            </a>
          )}
        </div>
      )}

      {/* Items */}
      {task.items.length > 0 && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Package size={16} /> Barang ({task.items.length})
          </div>
          <div className="space-y-1">
            {task.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{item.name}</span>
                <span className="text-gray-400">x{item.quantity}{item.weight ? ` (${item.weight}kg)` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {isDispatched && (
          <button
            onClick={startDelivery}
            disabled={submitting}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Mulai Perjalanan
          </button>
        )}

        {isTransit && (
          <>
            <button
              onClick={() => setShowPod(true)}
              disabled={submitting}
              className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle size={16} className="mr-2 inline" /> Selesaikan (POD)
            </button>
            <button
              onClick={() => markFailed('Penerima tidak ada di lokasi')}
              disabled={submitting}
              className="w-full rounded-xl border border-red-200 bg-white py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle size={16} className="mr-2 inline" /> Gagal Kirim
            </button>
          </>
        )}

        {isDelivered && (
          <div className="rounded-xl bg-green-50 p-4 text-center text-sm text-green-700">
            <CheckCircle size={24} className="mx-auto mb-2" />
            Pengiriman Selesai
          </div>
        )}
      </div>

      {/* POD Modal */}
      {showPod && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-t-2xl bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold">Proof of Delivery</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nama Penerima *</label>
                <input
                  type="text"
                  value={podData.recipientName}
                  onChange={(e) => setPodData({ ...podData, recipientName: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Nama yang menerima"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Catatan</label>
                <textarea
                  value={podData.notes}
                  onChange={(e) => setPodData({ ...podData, notes: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Catatan pengiriman"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowPod(false)} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium">
                  Batal
                </button>
                <button
                  onClick={submitPod}
                  disabled={!podData.recipientName || submitting}
                  className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {submitting ? 'Mengirim...' : 'Kirim POD'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DISPATCHED: 'bg-cyan-50 text-cyan-700', IN_TRANSIT: 'bg-blue-50 text-blue-700',
    OUT_FOR_DELIVERY: 'bg-indigo-50 text-indigo-700', DELIVERED: 'bg-green-50 text-green-700',
    DELIVERY_FAILED: 'bg-red-50 text-red-700',
  };
  const labels: Record<string, string> = {
    DISPATCHED: 'Siap Berangkat', IN_TRANSIT: 'Dalam Perjalanan',
    OUT_FOR_DELIVERY: 'Sedang Diantar', DELIVERED: 'Selesai', DELIVERY_FAILED: 'Gagal',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-50 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  );
}
