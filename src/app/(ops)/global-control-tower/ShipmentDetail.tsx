'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, RefreshCw, Truck, Package, MapPin, Clock, Phone, Navigation } from 'lucide-react';

type ShipmentDetail = {
  id: string;
  trackingNumber: string;
  status: string;
  origin: string;
  destination: string;
  serviceType: string;
  slaDeadline: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: { name?: string | null; phone?: string | null } | null;
  receiver?: { name?: string | null; phone?: string | null } | null;
  items?: { id: string; name?: string | null; quantity?: number | null; weight?: number | null }[] | null;
  assignments?: {
    id: string;
    assignedAt: string;
    driver?: { id: string; name: string; phone?: string | null; gpsLogs?: { latitude: number; longitude: number; speed?: number | null; createdAt: string }[] } | null;
    vehicle?: { vehicleNumber?: string | null } | null;
  }[] | null;
  events?: { id: string; status: string; notes?: string | null; latitude?: number | null; longitude?: number | null; createdAt: string }[] | null;
  pods?: { id: string; receiverName: string; deliveredAt: string; photo?: string | null }[] | null;
  stops?: { id: string; seq?: number | null; name?: string | null; type?: string | null; arrivedAt?: string | null }[] | null;
};

export const STATUS_LABELS: Record<string, string> = {
  ORDER_CREATED: 'Pesanan Dibuat',
  PICKUP_SCHEDULED: 'Penjemputan Dijadwalkan',
  PICKED_UP: 'Telah Dijemput',
  WAREHOUSE_RECEIVED: 'Diterima Gudang',
  SORTING: 'Proses Sortir',
  DISPATCHED: 'Dispatched',
  IN_TRANSIT: 'Dalam Perjalanan',
  ARRIVED_AT_HUB: 'Tiba di Hub',
  OUT_FOR_DELIVERY: 'Sedang Diantar',
  DELIVERED: 'Terkirim',
  DELIVERY_FAILED: 'Gagal Kirim',
  RESCHEDULED: 'Jadwal Ulang',
  RETURN_TO_SENDER: 'Kembali ke Pengirim',
  RETURNED: 'Dikembalikan',
};

const STATUS_COLORS: Record<string, string> = {
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  DELIVERY_FAILED: 'bg-red-100 text-red-600',
  RETURN_TO_SENDER: 'bg-amber-100 text-amber-700',
  RETURNED: 'bg-gray-200 text-gray-600',
  IN_TRANSIT: 'bg-blue-100 text-blue-700',
  OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-700',
};

function statusBadgeCls(status: string) {
  return STATUS_COLORS[status] || 'bg-sky-100 text-sky-700';
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff} detik lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}

export default function ShipmentDetail({ shipmentId, tenantName, onClose }: { shipmentId: string; tenantName: string; onClose: () => void }) {
  const [detail, setDetail] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}`);
      if (res.ok) {
        setDetail(await res.json());
        setError('');
      } else if (!detail) {
        setError('Gagal memuat detail pengiriman');
      }
    } catch {
      if (!detail) setError('Gagal memuat detail pengiriman');
    }
    setLoading(false);
    setRefreshing(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId]);

  useEffect(() => {
    load(true);
    const t = setInterval(() => load(true), 15000); // sinkron GPS live tiap 15s
    return () => clearInterval(t);
  }, [load]);

  const assignment = detail?.assignments?.[0] ?? null;
  const gps = assignment?.driver?.gpsLogs?.[0] ?? null;

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E4E7EC] px-5 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Package size={18} className="shrink-0 text-[#0D6EFD]" />
          {detail ? (
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-bold text-[#101828]">{detail.trackingNumber}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeCls(detail.status)}`}>
                  {STATUS_LABELS[detail.status] || detail.status}
                </span>
              </div>
              <div className="text-[11px] text-[#667085]">{tenantName} · {detail.origin} → {detail.destination}</div>
            </div>
          ) : (
            <span className="text-sm text-[#667085]">{loading ? 'Memuat detail...' : error}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-[10px] text-[#667085]">Sinkron GPS 15s</span>
          <button onClick={() => load()} disabled={refreshing} className="rounded-lg p-1.5 text-[#667085] hover:bg-[#F7F9FC] hover:text-[#101828] disabled:opacity-50" title="Refresh">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#667085] hover:bg-[#F7F9FC] hover:text-[#101828]" title="Tutup">
            <X size={16} />
          </button>
        </div>
      </div>

      {detail && (
        <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-3">
          {/* Kolom 1: Rute & Pengiriman */}
          <div className="space-y-3">
            <SectionTitle>Rute & Penerima</SectionTitle>
            <InfoRow icon={<Navigation size={13} />} label="Asal" value={detail.origin} />
            <InfoRow icon={<MapPin size={13} />} label="Tujuan" value={detail.destination} />
            <InfoRow icon={<Package size={13} />} label="Penerima" value={`${detail.receiver?.name || '-'}${detail.receiver?.phone ? ` · ${detail.receiver.phone}` : ''}`} />
            <InfoRow icon={<Package size={13} />} label="Pengirim" value={`${detail.sender?.name || '-'}${detail.sender?.phone ? ` · ${detail.sender.phone}` : ''}`} />
            <InfoRow icon={<Clock size={13} />} label="Layanan" value={detail.serviceType} />
            {detail.slaDeadline && (
              <InfoRow
                icon={<Clock size={13} />}
                label="Deadline SLA"
                value={new Date(detail.slaDeadline).toLocaleString('id-ID')}
                highlight={new Date(detail.slaDeadline) < new Date() ? 'text-red-600 font-semibold' : undefined}
              />
            )}

            {detail.items && detail.items.length > 0 && (
              <>
                <SectionTitle>Barang ({detail.items.length})</SectionTitle>
                <div className="space-y-1">
                  {detail.items.slice(0, 6).map((it) => (
                    <div key={it.id} className="flex items-center justify-between rounded-lg bg-[#F7F9FC] px-3 py-1.5 text-xs">
                      <span className="truncate text-[#101828]">{it.name || 'Item'}</span>
                      <span className="ml-2 shrink-0 text-[#667085]">{it.quantity ?? 1}x{it.weight ? ` · ${it.weight} kg` : ''}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Kolom 2: Driver & GPS Live */}
          <div className="space-y-3">
            <SectionTitle>Driver & Posisi Live</SectionTitle>
            {assignment?.driver ? (
              <>
                <div className="rounded-xl border border-[#E4E7EC] bg-gradient-to-br from-blue-50 to-white p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${gps ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                      <Truck size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-[#101828]">{assignment.driver.name}</div>
                      <div className="flex items-center gap-2 text-[11px] text-[#667085]">
                        {assignment.vehicle?.vehicleNumber ? <span>{assignment.vehicle.vehicleNumber}</span> : null}
                        {assignment.driver.phone && (
                          <span className="flex items-center gap-0.5"><Phone size={9} />{assignment.driver.phone}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {gps ? (
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-white px-2 py-1.5 ring-1 ring-[#E4E7EC]">
                        <div className="font-mono text-xs font-bold text-[#101828]">{gps.latitude.toFixed(4)}</div>
                        <div className="text-[9px] uppercase text-[#667085]">Latitude</div>
                      </div>
                      <div className="rounded-lg bg-white px-2 py-1.5 ring-1 ring-[#E4E7EC]">
                        <div className="font-mono text-xs font-bold text-[#101828]">{gps.longitude.toFixed(4)}</div>
                        <div className="text-[9px] uppercase text-[#667085]">Longitude</div>
                      </div>
                      <div className="rounded-lg bg-white px-2 py-1.5 ring-1 ring-[#E4E7EC]">
                        <div className="font-mono text-xs font-bold text-[#101828]">{Math.round(gps.speed ?? 0)} <span className="text-[9px]">km/h</span></div>
                        <div className="text-[9px] uppercase text-[#667085]">Kecepatan</div>
                      </div>
                      <div className="col-span-3 text-[10px] text-emerald-600">
                        ● Live — diperbarui {timeAgo(gps.createdAt)}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-lg bg-white px-3 py-2 text-[11px] text-[#667085] ring-1 ring-[#E4E7EC]">
                      Belum ada sinyal GPS dari driver ini.
                    </div>
                  )}
                </div>

                {detail.pods && detail.pods.length > 0 && (
                  <>
                    <SectionTitle>Bukti Pengiriman</SectionTitle>
                    {detail.pods.map((p) => (
                      <div key={p.id} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        Ditandatangani <strong>{p.receiverName}</strong> · {new Date(p.deliveredAt).toLocaleString('id-ID')}
                      </div>
                    ))}
                  </>
                )}

                {(!detail.pods || detail.pods.length === 0) && (
                  <div className="rounded-lg bg-[#F7F9FC] px-3 py-2 text-[11px] text-[#667085]">
                    Bukti pengiriman (PoD) belum tersedia.
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-[#E4E7EC] p-4 text-center text-xs text-[#667085]">
                Belum ada driver yang ditugaskan pada pengiriman ini.
              </div>
            )}
          </div>

          {/* Kolom 3: Riwayat Status */}
          <div className="space-y-3">
            <SectionTitle>Riwayat Perjalanan</SectionTitle>
            <div className="max-h-[280px] space-y-0 overflow-y-auto pr-1">
              {[...(detail.events || [])].reverse().map((ev, i, arr) => (
                <div key={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < arr.length - 1 && <div className="absolute left-[7px] top-4 h-full w-px bg-[#E4E7EC]" />}
                  <div className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-white ${i === 0 ? 'bg-[#0D6EFD]' : 'bg-[#98A2B3]'}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#101828]">{STATUS_LABELS[ev.status] || ev.status}</div>
                    <div className="text-[10px] text-[#667085]">
                      {new Date(ev.createdAt).toLocaleString('id-ID')}
                      {ev.notes ? ` · ${ev.notes}` : ''}
                    </div>
                  </div>
                </div>
              ))}
              {(!detail.events || detail.events.length === 0) && (
                <div className="text-xs text-[#667085]">Belum ada riwayat.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">{children}</h4>;
}

function InfoRow({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value?: string | null; highlight?: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="mt-0.5 text-[#98A2B3]">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-[#667085]">{label}</div>
        <div className={`truncate ${highlight || 'text-[#101828]'}`}>{value || '-'}</div>
      </div>
    </div>
  );
}
