'use client';

import { useEffect, useState } from 'react';
import { Package, MapPin, Clock, Truck, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Assignment = {
  id: string;
  shipmentId: string;
  assignedAt: string;
  shipment: {
    id: string;
    trackingNumber: string;
    status: string;
    origin: string;
    destination: string;
    sender: { name: string; phone: string; address: string; city: string } | null;
    receiver: { name: string; phone: string; address: string; city: string } | null;
  };
};

type DriverInfo = {
  name: string;
  employeeId: string;
  phone: string;
  status: string;
};

export default function DriverDashboard() {
  const router = useRouter();
  const [info, setInfo] = useState<DriverInfo | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/drivers/me').then(r => r.ok ? r.json() : null),
      fetch('/api/drivers/me/assignments').then(r => r.ok ? r.json() : []),
    ]).then(([driverData, assignData]) => {
      if (driverData) setInfo(driverData);
      if (assignData) setAssignments(assignData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Memuat...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
              {info?.name?.charAt(0) || 'D'}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">{info?.name || 'Driver'}</div>
              <div className="text-xs text-gray-500">{info?.employeeId}</div>
            </div>
          </div>
          <button onClick={logout} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck size={18} className="text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Status</span>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              info?.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {info?.status === 'ACTIVE' ? 'Aktif' : info?.status || 'Aktif'}
            </span>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Penugasan Aktif</h2>
          {assignments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <Package size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">Belum ada penugasan</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assignments.map(a => (
                <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{a.shipment.trackingNumber}</div>
                      <div className="mt-0.5 text-xs text-gray-500">Penerima: {a.shipment.receiver?.name || '-'}</div>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {a.shipment.status}
                    </span>
                  </div>
                  {a.shipment.receiver?.address && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                      <MapPin size={12} />
                      <span>{a.shipment.receiver.address}{a.shipment.receiver.city ? `, ${a.shipment.receiver.city}` : ''}</span>
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                    <Clock size={12} />
                    <span>{a.shipment.origin} → {a.shipment.destination}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
