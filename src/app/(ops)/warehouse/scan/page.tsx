"use client";

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { btnPrimary, btnGhost, inputCls } from '@/components/ui';
import { STATUS_LABELS, formatDateTime } from '@/lib/constants';
import StatusBadge from '@/components/StatusBadge';

const WAREHOUSE_FLOW: Record<string, string> = {
  ORDER_CREATED: 'WAREHOUSE_RECEIVED',
  PICKUP_SCHEDULED: 'WAREHOUSE_RECEIVED',
  PICKED_UP: 'WAREHOUSE_RECEIVED',
  WAREHOUSE_RECEIVED: 'DISPATCHED',
  SORTING: 'DISPATCHED',
};

const ACTION_HINT: Record<string, string> = {
  WAREHOUSE_RECEIVED: 'verifikasi di gudang',
  DISPATCHED: 'berangkatkan',
};

type ShipmentHit = {
  id: string;
  trackingNumber: string;
  status: string;
  destination: string;
  sender?: { name: string } | null;
  receiver?: { name: string } | null;
  Customer_Shipment_senderIdToCustomer?: { name: string };
  Customer_Shipment_receiverIdToCustomer?: { name: string };
};

type ScanItem = {
  id: string;
  action: string;
  trackingNumber: string;
  destination: string;
  createdAt: string;
};

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-[#667085]">Memuat...</div>}>
      <ScanInner />
    </Suspense>
  );
}

function ScanInner() {
  const params = useSearchParams();
  const [code, setCode] = useState(params.get('resi') || '');
  const [hit, setHit] = useState<ShipmentHit | null>(null);
  const [notFound, setNotFound] = useState('');
  const [dispatchMsg, setDispatchMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [camOn, setCamOn] = useState(false);
  const [camErr, setCamErr] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => { loadScans(); }, []);

  async function loadScans() {
    const res = await fetch('/api/warehouse/scans');
    if (res.ok) setScans(await res.json());
  }

  async function search(raw?: string) {
    const q = (raw ?? code).trim();
    if (!q) return;
    setLoading(true);
    setNotFound('');
    setHit(null);
    setDispatchMsg('');
    try {
      if (/^DRV:.+:SHP:.+$/i.test(q)) {
        await dispatchDriver(q);
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/shipments?q=${encodeURIComponent(q)}&pageSize=100`);
      const data = await res.json();
      const list = data.items || [];
      const found = (list || []).find((s: ShipmentHit) => s.trackingNumber.toLowerCase() === q.toLowerCase() || s.id === q);
      if (!found) setNotFound('Resi tidak ditemukan. Pastikan kode sudah benar.');
      else setHit(found);
    } catch {
      setNotFound('Gagal mencari resi');
    }
    setLoading(false);
  }

  async function dispatchDriver(q: string) {
    setDispatchMsg('');
    setNotFound('');
    try {
      const res = await fetch('/api/warehouse/dispatch-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotFound(data.error || 'Gagal memberangkatkan shipment');
        return;
      }
      setDispatchMsg(`✅ ${data.shipment?.trackingNumber} diberangkatkan (${data.driver || 'driver'})`);
      setCode('');
      await loadScans();
    } catch {
      setNotFound('Gagal memproses scan driver');
    }
  }

  async function doScan(action: string) {
    if (!hit) return;
    setLoading(true);
    setNotFound('');
    try {
      const res = await fetch(`/api/shipments/${hit.id}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotFound(data.error || 'Scan gagal');
        return;
      }
      setHit((prev) => (prev ? { ...prev, status: data.shipment.status } : prev));
      await loadScans();
    } catch {
      setNotFound('Gagal memproses scan');
    } finally {
      setLoading(false);
    }
  }

  async function toggleCamera() {
    if (camOn) {
      stopCamera();
      setCamOn(false);
      return;
    }
    const anyWin = window as any;
    if (!anyWin.BarcodeDetector) {
      setCamErr('BarcodeDetector tidak didukung browser ini. Gunakan input resi atau scanner USB.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamOn(true);
      setCamErr('');
      const detector = new anyWin.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'codabar', 'datamatrix'] });
      const loop = setInterval(async () => {
        if (!videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length) {
            clearInterval(loop);
            const value = codes[0].rawValue.trim();
            setCode(value);
            stopCamera();
            setCamOn(false);
            search(value);
          }
        } catch { /* bingkai belum siap */ }
      }, 500);
      (videoRef.current as any).__loop = loop;
    } catch {
      setCamErr('Kamera tidak dapat diakses. Periksa izin kamera atau gunakan input resi.');
    }
  }

  function stopCamera() {
    const v = videoRef.current;
    if (v?.srcObject) (v.srcObject as any).getTracks?.().forEach((t: MediaStreamTrack) => t.stop());
    clearInterval((v as any)?.__loop);
  }

  useEffect(() => () => stopCamera(), []);

  const nextAction = hit ? WAREHOUSE_FLOW[hit.status] : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#101828]">Warehouse Scan</h1>
        <p className="text-sm text-[#667085]">Scan barcode/QR untuk proses verifikasi gudang – dispatch. Scan QR driver (DRV:...) untuk memberangkatkan.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <form
            onSubmit={(e) => { e.preventDefault(); search(); }}
            className="space-y-3"
          >
            <label className="mb-1 block text-xs font-semibold text-[#667085]">Nomor Resi / Tracking</label>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="DTMS-..." 
                className={inputCls}
                autoFocus
              />
              <button type="submit" disabled={loading} className={btnPrimary + ' shrink-0'}>Cari</button>
            </div>
            <button type="button" onClick={toggleCamera} className={btnGhost + ' w-full'}>
              {camOn ? '⏹ Matikan Kamera' : '📷 Scan Kamera'}
            </button>
          </form>

          <div className="mt-3 overflow-hidden rounded-lg bg-[#061B41]">
            <video ref={videoRef} playsInline muted className="h-56 w-full object-cover" style={{ display: camOn ? 'block' : 'none' }} />
            {!camOn && (
              <div className="flex h-56 items-center justify-center text-center text-xs text-[#667085]">
                {camErr || 'Kamera mati — aktifkan untuk memindai QR/barcode di label'}
              </div>
            )}
          </div>

          {notFound && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{notFound}</div>}
          {dispatchMsg && <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{dispatchMsg}</div>}

          {hit && (
            <div className="mt-4 rounded-xl border border-[#E4E7EC] p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-[#0D6EFD]">{hit.trackingNumber}</span>
                <StatusBadge status={hit.status} />
              </div>
              <div className="mt-2 grid gap-1 text-xs text-[#667085] sm:grid-cols-3">
                <div><b>Pengirim:</b> {(hit.sender?.name || hit.Customer_Shipment_senderIdToCustomer?.name) || '-'}</div>
                <div><b>Penerima:</b> {(hit.receiver?.name || hit.Customer_Shipment_receiverIdToCustomer?.name) || '-'}</div>
                <div><b>Tujuan:</b> {hit.destination}</div>
              </div>
              <div className="mt-3">
                {nextAction ? (
                  <button onClick={() => doScan(nextAction)} disabled={loading} className={btnPrimary + ' w-full'}>
                    Scan → {STATUS_LABELS[nextAction]} ({ACTION_HINT[nextAction]})
                  </button>
                ) : (
                  <p className="text-xs text-[#667085]">
                    Status {hit.status} di luar alur gudang (ORDER_CREATED → WAREHOUSE_RECEIVED → DISPATCHED).
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="mb-3 text-sm font-bold text-[#101828]">Riwayat Scan Terakhir</h2>
          <ul className="divide-y divide-[#E4E7EC]">
            {scans.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-semibold text-[#101828]">{s.trackingNumber}</p>
                  <p className="text-[11px] text-[#667085]">{s.destination} · {formatDateTime(s.createdAt)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#0D6EFD]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#0D6EFD]">
                  {STATUS_LABELS[s.action] || s.action}
                </span>
              </li>
            ))}
            {scans.length === 0 && <li className="py-8 text-center text-sm text-[#667085]">Belum ada scan</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
