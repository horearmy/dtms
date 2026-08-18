'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, MapPin, Clock, Truck, AlertTriangle, CheckCircle } from 'lucide-react';

type TaskSummary = {
  id: string;
  trackingNumber: string;
  destination: string;
  status: string;
  assignedAt: string;
  vehicleNumber: string | null;
};

export default function DriverDashboard() {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverName, setDriverName] = useState('');

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    try {
      const res = await fetch('/api/driver/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
        setDriverName(data.driverName || 'Driver');
      }
    } catch {
      // offline mode — try cached
      const cached = localStorage.getItem('driver_tasks');
      if (cached) setTasks(JSON.parse(cached));
    }
    setLoading(false);
  }

  const todayTasks = tasks.filter((t) => {
    const d = new Date(t.assignedAt);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });

  const activeTasks = todayTasks.filter((t) => ['DISPATCHED', 'IN_TRANSIT'].includes(t.status));
  const deliveredTasks = todayTasks.filter((t) => t.status === 'DELIVERED');
  const failedTasks = todayTasks.filter((t) => t.status === 'DELIVERY_FAILED');

  // Cache for offline
  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem('driver_tasks', JSON.stringify(tasks));
    }
  }, [tasks]);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-500">Memuat...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 p-5 text-white">
        <div className="text-sm opacity-80">Selamat Datang</div>
        <div className="text-xl font-bold">{driverName}</div>
        <div className="mt-2 flex items-center gap-4 text-sm opacity-90">
          <span className="flex items-center gap-1"><Package size={14} /> {todayTasks.length} tugas hari ini</span>
          <span className="flex items-center gap-1"><CheckCircle size={14} /> {deliveredTasks.length} selesai</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard icon={<Truck size={18} />} label="Aktif" value={activeTasks.length} color="bg-blue-50 text-blue-600" />
        <StatCard icon={<CheckCircle size={18} />} label="Selesai" value={deliveredTasks.length} color="bg-green-50 text-green-600" />
        <StatCard icon={<AlertTriangle size={18} />} label="Gagal" value={failedTasks.length} color="bg-red-50 text-red-600" />
      </div>

      {/* Active Tasks */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Tugas Aktif</h2>
        {activeTasks.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-400">
            Tidak ada tugas aktif
          </div>
        ) : (
          <div className="space-y-2">
            {activeTasks.map((task) => (
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
                {task.vehicleNumber && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                    <Truck size={12} /> {task.vehicleNumber}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Delivered */}
      {deliveredTasks.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Selesai Hari Ini</h2>
          <div className="space-y-2">
            {deliveredTasks.slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 opacity-70">
                <CheckCircle size={16} className="text-green-500" />
                <div className="font-mono text-sm text-gray-600">{task.trackingNumber}</div>
                <div className="ml-auto text-xs text-gray-400">{task.destination}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl p-3 text-center ${color}`}>
      <div className="flex justify-center mb-1">{icon}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs opacity-70">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DISPATCHED: 'bg-cyan-50 text-cyan-700',
    IN_TRANSIT: 'bg-blue-50 text-blue-700',
    OUT_FOR_DELIVERY: 'bg-indigo-50 text-indigo-700',
    DELIVERED: 'bg-green-50 text-green-700',
    DELIVERY_FAILED: 'bg-red-50 text-red-700',
  };
  const labels: Record<string, string> = {
    DISPATCHED: 'Dikirim', IN_TRANSIT: 'Transit', OUT_FOR_DELIVERY: 'Diantar',
    DELIVERED: 'Selesai', DELIVERY_FAILED: 'Gagal',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-50 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  );
}
