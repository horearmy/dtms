'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Clock, Fuel } from 'lucide-react';

export default function DriverLaporanPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    deliveredCount: 0,
    failedCount: 0,
    rescheduledCount: 0,
    fuelLiter: 0,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/driver/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      router.push('/driver');
    } catch {
      alert('Gagal mengirim laporan');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
      <h1 className="mb-6 text-lg font-bold text-gray-900">Laporan Harian</h1>

      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <CheckCircle size={16} className="text-green-500" /> Ringkasan Pengiriman
          </div>
          <div className="space-y-3">
            <Counter
              label="Berhasil Dikirim"
              value={form.deliveredCount}
              onChange={(v) => setForm({ ...form, deliveredCount: v })}
              color="text-green-600"
            />
            <Counter
              label="Gagal"
              value={form.failedCount}
              onChange={(v) => setForm({ ...form, failedCount: v })}
              color="text-red-600"
            />
            <Counter
              label="Dijadwal Ulang"
              value={form.rescheduledCount}
              onChange={(v) => setForm({ ...form, rescheduledCount: v })}
              color="text-amber-600"
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Fuel size={16} className="text-blue-500" /> BBM (Liter)
          </div>
          <input
            type="number"
            min={0}
            value={form.fuelLiter || ''}
            onChange={(e) => setForm({ ...form, fuelLiter: parseFloat(e.target.value) || 0 })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="0"
          />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 text-sm font-semibold text-gray-700">Catatan</div>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            rows={3}
            placeholder="Catatan hari ini..."
          />
        </div>

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Mengirim...' : 'Kirim Laporan'}
        </button>
      </div>
    </div>
  );
}

function Counter({ label, value, onChange, color }: { label: string; value: number; onChange: (v: number) => void; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="h-7 w-7 rounded-lg border border-gray-200 text-sm font-bold text-gray-500 hover:bg-gray-50"
        >
          -
        </button>
        <span className={`w-8 text-center text-sm font-bold ${color}`}>{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          className="h-7 w-7 rounded-lg border border-gray-200 text-sm font-bold text-gray-500 hover:bg-gray-50"
        >
          +
        </button>
      </div>
    </div>
  );
}
