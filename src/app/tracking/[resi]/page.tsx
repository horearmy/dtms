import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { STATUS_LABELS, STATUS_COLORS, formatDateTime } from '@/lib/constants';
import { dynamicETA, haversineKm, formatRemaining } from '@/lib/eta';
import { getSLA } from '@/lib/eta';
import TrackingSearch from '../TrackingSearch';

export const dynamic = 'force-dynamic';

function toE164(phone?: string | null) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return '62' + digits.slice(1);
  if (digits.startsWith('62')) return digits;
  return '62' + digits;
}

export default async function TrackingResultPage({ params }: { params: Promise<{ resi: string }> }) {
  const { resi } = await params;
  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber: resi.toUpperCase().trim() },
    include: {
      sender: true,
      receiver: true,
      events: { orderBy: { createdAt: 'asc' } },
      pods: true,
      assignments: { include: { driver: true, vehicle: true }, take: 1 },
    },
  });

  if (!shipment) return notFound();

  const pod = shipment.pods[0];
  const assignment = shipment.assignments[0];

  const lastEvent = shipment.events[shipment.events.length - 1];
  const refLat = lastEvent?.latitude ?? shipment.originLat ?? -6.2088;
  const refLng = lastEvent?.longitude ?? shipment.originLng ?? 106.8456;

  let eta = dynamicETA({ distanceKm: shipment.destLat ? haversineKm(refLat, refLng, shipment.destLat, shipment.destLng ?? refLng) : 0 });
  let sla = getSLA(shipment.status, shipment.slaDeadline, shipment.serviceType);
  if (!shipment.destLat) eta = new Date(Date.now() + 12 * 3600000);

  const slaBadge =
    sla.type === 'BREACHED'
      ? { label: 'SLA Terlambat', cls: 'bg-red-100 text-red-700 border-red-200' }
      : sla.type === 'AT_RISK'
        ? { label: 'SLA At Risk', cls: 'bg-amber-100 text-amber-700 border-amber-200' }
        : sla.type === 'ON_TIME'
          ? { label: 'SLA On Time', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
          : null;

  const waMsg = encodeURIComponent(
    `Halo ${shipment.receiver.name}, paket ${shipment.trackingNumber} Anda saat ini: ${STATUS_LABELS[shipment.status] || shipment.status}. Estimasi tiba: ${formatDateTime(eta)}. ${shipment.destination}`
  );
  const waPhone = toE164(shipment.receiver.phone);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-brand-700 px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 flex items-center justify-between">
            <Link href="/tracking" className="flex items-center gap-2 text-sm font-semibold text-white hover:underline">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-base">📦</span>
              DTMS Tracking
            </Link>
            <Link href="/login" className="text-xs text-brand-100 underline">Masuk</Link>
          </div>
          <TrackingSearch initial={shipment.trackingNumber} />
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs uppercase text-slate-400">Nomor Resi</div>
              <div className="font-mono text-lg font-bold text-brand-700">{shipment.trackingNumber}</div>
            </div>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${STATUS_COLORS[shipment.status] || 'bg-slate-100 text-slate-600'}`}>
              {STATUS_LABELS[shipment.status]}
            </span>
          </div>

          {slaBadge && (
            <div className={`mt-3 flex items-center justify-between rounded-xl border px-4 py-3 ${slaBadge.cls}`}>
              <div>
                <div className="text-sm font-bold">{slaBadge.label}</div>
                <div className="text-xs opacity-80">Deadline: {shipment.slaDeadline ? formatDateTime(shipment.slaDeadline) : '-'} · {sla.type === 'BREACHED' ? 'Sudah lewat' : `${formatRemaining(sla.remainingMs)} tersisa`}</div>
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-4">
            <div>
              <div className="text-[11px] uppercase text-slate-400">Asal</div>
              <div className="font-medium text-slate-700">{shipment.origin}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase text-slate-400">Tujuan</div>
              <div className="font-medium text-slate-700">{shipment.destination}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase text-slate-400">Penerima</div>
              <div className="font-medium text-slate-700">{shipment.receiver.name}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase text-slate-400">Estimasi Tiba</div>
              <div className="font-medium text-slate-700">{formatDateTime(eta)}</div>
            </div>
          </div>

          {assignment && (
            <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span>Kurir: <b className="text-slate-700">{assignment.driver.name}</b></span>
              <span>Kendaraan: <b className="text-slate-700">{assignment.vehicle?.vehicleNumber || '-'}</b></span>
              <span>Last update: <b className="text-slate-700">{formatDateTime(shipment.updatedAt)}</b></span>
            </div>
          )}

          {waPhone && (
            <a
              href={`https://wa.me/${waPhone}?text=${waMsg}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2A10 10 0 002 12a9.9 9.9 0 002.3 6.4L3 22l3.8-1.2A9.9 9.9 0 0012 22h.1A10 10 0 0012 2zm5.6 14.2c-.2.6-1.2 1.2-1.7 1.2-.4.1-.9.1-1.5-.1-2.2-.8-4.1-2.5-5.4-4.9-.4-.7-.7-1.5-.7-1.9 0-.5.2-.9.5-1.3.2-.3.4-.5.6-.7.2-.1.3-.1.4-.1h.4c.1 0 .3-.1.5.4l.7 1.6c.1.2.1.4 0 .6l-.4.6c-.1.2-.2.4 0 .6.4.6 1 1.2 1.5 1.6.2.2.4.3.6.1.1-.2.4-.4.6-.7.2-.2.4-.2.6-.1l1.6.8c.2.1.4.3.5.4.1.2.1.3 0 .6z"/></svg>
              Share status via WhatsApp
            </a>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Riwayat Perjalanan</h2>
          <div>
            {shipment.events.map((ev, i) => {
              const isLast = i === shipment.events.length - 1;
              const isCurrent = i === shipment.events.length - 1;
              return (
                <div key={ev.id} className="relative flex gap-3 pb-6">
                  {!isLast && <span className="absolute left-[9px] top-6 h-full w-0.5 bg-slate-200" />}
                  <span className={`relative mt-0.5 h-5 w-5 shrink-0 rounded-full border-4 ${
                    isCurrent
                      ? STATUS_COLORS[ev.status]?.includes('bg-emerald')
                        ? 'border-emerald-200 bg-emerald-500'
                        : STATUS_COLORS[ev.status]?.includes('bg-red')
                          ? 'border-red-200 bg-red-500'
                          : 'border-brand-200 bg-brand-500'
                      : 'border-slate-200 bg-slate-300'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm font-semibold ${isCurrent ? 'text-slate-900' : 'text-slate-500'}`}>
                        {STATUS_LABELS[ev.status] || ev.status}
                      </span>
                      <span className="text-[11px] text-slate-400">{formatDateTime(ev.createdAt)}</span>
                    </div>
                    {ev.notes && <p className="text-xs text-slate-500">{ev.notes}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {pod && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="text-sm font-bold text-emerald-800">✓ Bukti Penerimaan</div>
            <p className="mt-1 text-sm text-emerald-700">
              Barang diterima oleh <b>{pod.receiverName}</b> pada {formatDateTime(pod.deliveredAt)}.
            </p>
          </div>
        )}
      </main>

      <footer className="py-6 text-center text-xs text-slate-400">
        Delivery Tracking & Management System · Layanan pelanggan: 021-555-0199
      </footer>
    </div>
  );
}