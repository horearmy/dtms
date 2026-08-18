'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Truck, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

type Task = {
  id: string;
  trackingNumber: string;
  destination: string;
  status: string;
  assignedAt: string;
  vehicleNumber: string | null;
};

export default function DriverTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'delivered' | 'failed'>('all');

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    try {
      const res = await fetch('/api/driver/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch {
      const cached = localStorage.getItem('driver_tasks');
      if (cached) setTasks(JSON.parse(cached));
    }
    setLoading(false);
  }

  const filtered = tasks.filter((t) => {
    if (filter === 'active') return ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(t.status);
    if (filter === 'delivered') return t.status === 'DELIVERED';
    if (filter === 'failed') return t.status === 'DELIVERY_FAILED';
    return true;
  });

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-500">Memuat...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
      <h1 className="mb-4 text-lg font-bold text-gray-900">Daftar Tugas</h1>

      {/* Filter */}
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {[
          { key: 'all', label: 'Semua', icon: <Clock size={14} /> },
          { key: 'active', label: 'Aktif', icon: <Truck size={14} /> },
          { key: 'delivered', label: 'Selesai', icon: <CheckCircle size={14} /> },
          { key: 'failed', label: 'Gagal', icon: <AlertTriangle size={14} /> },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as typeof filter)}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              filter === f.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {f.icon} {f.label}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-400">
            Tidak ada tugas
          </div>
        ) : (
          filtered.map((task) => (
            <Link
              key={task.id}
              href={`/driver/tasks/${task.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-sm font-semibold text-blue-600">{task.trackingNumber}</div>
                  <div className="mt-1 flex items-center gap-1 text-sm text-gray-600">
                    <MapPin size={12} /> {task.destination}
                  </div>
                </div>
                <StatusBadge status={task.status} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                <span>{task.vehicleNumber || '-'}</span>
                <span>{new Date(task.assignedAt).toLocaleString('id-ID')}</span>
              </div>
            </Link>
          ))
        )}
      </div>
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
    DISPATCHED: 'Siap', IN_TRANSIT: 'Transit', OUT_FOR_DELIVERY: 'Diantar',
    DELIVERED: 'Selesai', DELIVERY_FAILED: 'Gagal',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-50 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  );
}
