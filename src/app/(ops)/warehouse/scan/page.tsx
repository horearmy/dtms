"use client";

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { btnPrimary, btnGhost, inputCls } from '@/components/ui';
import { STATUS_LABELS, formatDateTime } from '@/lib/constants';
import StatusBadge from '@/components/StatusBadge';

const WAREHOUSE_FLOW: Record<string, string> = {
  PICKED_UP: 'WAREHOUSE_RECEIVED',
  WAREHOUSE_RECEIVED: 'SORTING',
  SORTING: 'DISPATCHED',
};

type ShipmentHit = {
  id: string;
  trackingNumber: string;
  status: string;
  destination: string;
  sender: { name: string };
  receiver: { name: string };
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
    <Suspense fallback={<div className="py-20 text-center text-slate-400">Memuat...</div>}>
      <ScanInner />
    </Suspense>
  );
}

function ScanInner() {
  const params = useSearchParams();
  const [code, setCode] = useState(params.get('resi') || '');
  const [hit, setHit] = useState<ShipmentHit | null>(null);
  const [notFound, setNotFound] = useState('');
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
    try {
      const res = await fetch(`/api/shipments?q=${encodeURIComponent(q)}`);
      const list = await res.json();
      const found = (list || []).find((s: ShipmentHit) => s.trackingNumber.toLowerCase() === q.toLowerCase() || s.id === q);
      if (!found) setNotFound('Resi tidak ditemukan. Pastikan kode sudah benar.');
      else setHit(found);
    } catch {
      setNotFound('Gagal mencari resi');
    }
    setLoading(false);
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
        <h1 className="text-xl font-bold text-slate-900">Warehouse Scan</h1>
        <p className="text-sm text-slate-500">Scan barcode/QR untuk proses inbound – sorting – dispatch</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <form
            onSubmit={(e) => { e.preventDefault(); search(); }}
            className="space-y-3"
          >
            <label className="mb-1 block text-xs font-semibold text-slate-600">Nomor Resi / Tracking</label>
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

          <div className="mt-3 overflow-hidden rounded-lg bg-slate-900">
            <video ref={videoRef} playsInline muted className="h-56 w-full object-cover" style={{ display: camOn ? 'block' : 'none' }} />
            {!camOn && (
              <div className="flex h-56 items-center justify-center text-center text-xs text-slate-400">
                {camErr || 'Kamera mati — aktifkan untuk memindai QR/barcode di label'}
              </div>
            )}
          </div>

          {notFound && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{notFound}</div>}

          {hit && (
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-brand-700">{hit.trackingNumber}</span>
                <StatusBadge status={hit.status} />
              </div>
              <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-3">
                <div><b>Pengirim:</b> {hit.sender.name}</div>
                <div><b>Penerima:</b> {hit.receiver.name}</div>
                <div><b>Tujuan:</b> {hit.destination}</div>
              </div>
              <div className="mt-3">
                {nextAction ? (
                  <button onClick={() => doScan(nextAction)} disabled={loading} className={btnPrimary + ' w-full'}>
                    Scan → {STATUS_LABELS[nextAction]} (terima di gudang)
                  </button>
                ) : (
                  <p className="text-xs text-slate-400">
                    Status {hit.status} di luar alur gudang (PICKED_UP → WAREHOUSE_RECEIVED → SORTING → DISPATCHED).
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-900">Riwayat Scan Terakhir</h2>
          <ul className="divide-y divide-slate-100">
            {scans.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-semibold text-slate-700">{s.trackingNumber}</p>
                  <p className="text-[11px] text-slate-400">{s.destination} · {formatDateTime(s.createdAt)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700">
                  {STATUS_LABELS[s.action] || s.action}
                </span>
              </li>
            ))}
            {scans.length === 0 && <li className="py-8 text-center text-sm text-slate-400">Belum ada scan</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}