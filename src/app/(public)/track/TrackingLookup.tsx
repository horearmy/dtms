"use client";

import { useState } from 'react';

type Timeline = { status: string; statusLabel: string; location: string | null; notes: string | null; timestamp: string };
type TrackingResult = {
  trackingNumber: string; origin: string; destination: string; status: string; statusLabel: string;
  serviceType: string; itemName: string | null; itemCount: number; weight: number;
  sender: string; receiver: string; createdAt: string; updatedAt: string; slaDeadline: string | null;
  timeline: Timeline[]; pod: { receiverName: string; deliveredAt: string; notes: string | null } | null;
};

const STATUS_DOT: Record<string, string> = {
  DELIVERED: 'bg-green-500', DELIVERY_FAILED: 'bg-red-500', OUT_FOR_DELIVERY: 'bg-blue-500',
  IN_WAREHOUSE: 'bg-yellow-500', PICKED_UP: 'bg-purple-500',
};

export default function TrackingLookup() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    const res = await fetch(`/api/track?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Terjadi kesalahan.');
    } else {
      setResult(data);
    }
  }

  return (
    <div>
      <form onSubmit={search} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Masukkan nomor tracking..."
          className="flex-1 rounded-lg border border-[#D0D5DD] bg-white px-4 py-3 text-sm focus:border-[#0D6EFD] focus:outline-none focus:ring-1 focus:ring-[#0D6EFD]"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[#0D6EFD] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0B5ED7] disabled:opacity-50"
        >
          {loading ? 'Mencari...' : 'Lacak'}
        </button>
      </form>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-[#E4E7EC] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#101828]">{result.trackingNumber}</h2>
                <p className="text-sm text-[#667085]">{result.serviceType}</p>
              </div>
              <span className="rounded-full bg-[#ECFDF3] px-3 py-1 text-sm font-semibold text-[#027A48]">{result.statusLabel}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-[#667085]">Dari:</span> <span className="font-medium text-[#101828]">{result.origin}</span></div>
              <div><span className="text-[#667085]">Ke:</span> <span className="font-medium text-[#101828]">{result.destination}</span></div>
              <div><span className="text-[#667085]">Pengirim:</span> <span className="font-medium text-[#101828]">{result.sender}</span></div>
              <div><span className="text-[#667085]">Penerima:</span> <span className="font-medium text-[#101828]">{result.receiver}</span></div>
              <div><span className="text-[#667085]">Barang:</span> <span className="font-medium text-[#101828]">{result.itemName || '-'} ({result.itemCount} pcs, {result.weight} kg)</span></div>
              <div><span className="text-[#667085]">Dibuat:</span> <span className="font-medium text-[#101828]">{new Date(result.createdAt).toLocaleString('id-ID')}</span></div>
            </div>
          </div>

          {result.timeline.length > 0 && (
            <div className="rounded-xl border border-[#E4E7EC] bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#667085]">Timeline</h3>
              <div className="space-y-4">
                {result.timeline.map((t, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="mt-1 flex flex-col items-center">
                      <div className={`h-3 w-3 rounded-full ${STATUS_DOT[t.status] || 'bg-gray-300'}`} />
                      {i < result.timeline.length - 1 && <div className="mt-1 w-0.5 flex-1 bg-gray-200" />}
                    </div>
                    <div className="pb-4">
                      <div className="text-sm font-semibold text-[#101828]">{t.statusLabel}</div>
                      {t.location && <div className="text-xs text-[#667085]">{t.location}</div>}
                      {t.notes && <div className="mt-1 text-xs text-[#667085] italic">{t.notes}</div>}
                      <div className="mt-0.5 text-xs text-[#98A2B3]">{new Date(t.timestamp).toLocaleString('id-ID')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.pod && (
            <div className="rounded-xl border border-[#E4E7EC] bg-white p-6 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#667085]">Proof of Delivery</h3>
              <div className="text-sm text-[#101828]">
                Diterima oleh: <span className="font-semibold">{result.pod.receiverName}</span>
                {' — '}
                {new Date(result.pod.deliveredAt).toLocaleString('id-ID')}
              </div>
              {result.pod.notes && <div className="mt-1 text-xs text-[#667085]">{result.pod.notes}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
