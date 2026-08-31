"use client";

import { useEffect, useRef, useState } from 'react';
import { btnPrimary, btnGhost, inputCls } from '@/components/ui';
import { VEHICLE_CHECK_ITEMS } from '@/lib/vehicle-checklist';

type WarehouseInfo = {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  address: string | null;
};

type Props = {
  onDone: (result: { vehicleStatus: string; issueCount: number }) => void;
};

export default function DriverArrivalConfirm({ onDone }: Props) {
  const [step, setStep] = useState<'scan' | 'checklist' | 'done'>('scan');
  const [code, setCode] = useState('');
  const [warehouse, setWarehouse] = useState<WarehouseInfo | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [camErr, setCamErr] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  const [answers, setAnswers] = useState<Record<string, 'ok' | 'issue'>>({});
  const [notes, setNotes] = useState('');
  const [confirmMsg, setConfirmMsg] = useState('');

  useEffect(() => () => stopCamera(), []);

  async function verify(codeRaw: string) {
    const c = codeRaw.trim();
    if (!c) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(`/api/driver/verify-warehouse?code=${encodeURIComponent(c)}`);
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Kode gudang tidak valid');
        setBusy(false);
        return;
      }
      setWarehouse(data.warehouse);
      setStep('checklist');
    } catch {
      setErr('Gagal terhubung ke server');
    }
    setBusy(false);
  }

  async function submitChecklist() {
    if (busy) return;
    setBusy(true);
    setErr('');
    setConfirmMsg('');
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
        );
      });
      lat = pos?.lat ?? null;
      lng = pos?.lng ?? null;
    } catch {
      // lokasi opsional
    }
    try {
      const res = await fetch('/api/driver/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', warehouseCode: warehouse?.code, answers, notes, lat, lng }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Gagal menyimpan konfirmasi tiba');
        setBusy(false);
        return;
      }
      setConfirmMsg(data.issueCount > 0 ? 'Kendaraan dialihkan ke perawatan (MAINTENANCE).' : 'Berhasil. Terima kasih!');
      setStep('done');
      onDone(data);
    } catch {
      setErr('Gagal terhubung ke server');
    }
    setBusy(false);
  }

  async function toggleCamera() {
    if (camOn) {
      stopCamera();
      setCamOn(false);
      return;
    }
    const anyWin = window as any;
    if (!anyWin.BarcodeDetector) {
      setCamErr('BarcodeDetector tidak didukung browser ini. Gunakan input kode gudang.');
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
            stopCamera();
            setCamOn(false);
            setCode(value);
            verify(value);
          }
        } catch { /* bingkai belum siap */ }
      }, 500);
      (videoRef.current as any).__loop = loop;
    } catch {
      setCamErr('Kamera tidak dapat diakses. Periksa izin kamera atau input kode gudang.');
    }
  }

  function stopCamera() {
    const v = videoRef.current;
    if (v?.srcObject) (v.srcObject as any).getTracks?.().forEach((t: MediaStreamTrack) => t.stop());
    clearInterval((v as any)?.__loop);
  }

  if (step === 'done') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <p className="text-lg font-bold text-emerald-700">✓ Konfirmasi Tiba Berhasil</p>
        <p className="mt-1 text-sm text-emerald-700">{confirmMsg}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      {step === 'scan' && (
        <div>
          <p className="text-sm font-bold text-amber-800">Konfirmasi Tiba di Gudang Asal</p>
          <p className="mb-3 text-xs text-amber-700">
            Wajib scan QR gudang asal untuk mengonfirmasi kedatangan.
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); verify(code); }}
            className="space-y-3"
          >
            <div>
              <label className="mb-1 block text-xs font-semibold text-amber-900">Kode QR Gudang</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="WH-001"
                className={inputCls}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={btnPrimary + ' flex-1'}>
                {busy ? 'Memverifikasi...' : 'Verifikasi Kode Gudang'}
              </button>
              <button type="button" onClick={toggleCamera} className={btnGhost}>
                {camOn ? '⏹ Matikan Kamera' : '📷 Scan Kamera'}
              </button>
            </div>
            <div className="overflow-hidden rounded-lg bg-[#061B41]">
              <video ref={videoRef} playsInline muted className="h-48 w-full object-cover" style={{ display: camOn ? 'block' : 'none' }} />
              {!camOn && (
                <div className="flex h-20 items-center justify-center text-center text-xs text-[#667085]">
                  {camErr || 'Kamera mati — aktifkan untuk memindai QR gudang'}
                </div>
              )}
            </div>
            {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
          </form>
        </div>
      )}

      {step === 'checklist' && warehouse && (
        <div>
          <p className="text-sm font-bold text-amber-800">Ceklist Kendaraan Pasca Perjalanan</p>
          <p className="mb-3 text-xs text-amber-700">
            Gudang: <b>{warehouse.name}</b> ({warehouse.city || '-'}). Periksa kendaraan setelah perjalanan. Apabila ada masalah, kendaraan dialihkan untuk perawatan.
          </p>
          <div className="space-y-2">
            {VEHICLE_CHECK_ITEMS.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#101828]">{item.label}</p>
                  {item.hint && <p className="text-[11px] text-[#667085]">{item.hint}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, [item.key]: 'ok' }))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold ${answers[item.key] === 'ok' ? 'bg-emerald-500 text-white' : 'bg-[#EAECF0] text-[#344054]'}`}
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, [item.key]: 'issue' }))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold ${answers[item.key] === 'issue' ? 'bg-red-500 text-white' : 'bg-[#EAECF0] text-[#344054]'}`}
                  >
                    Masalah
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-semibold text-amber-900">Catatan (opsional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} rows={2} placeholder="Detail masalah / keterangan" />
          </div>
          {err && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
          <div className="mt-3 flex gap-2">
            <button onClick={submitChecklist} disabled={busy} className={btnPrimary + ' flex-1'}>
              {busy ? 'Menyimpan...' : 'Kirim Konfirmasi Tiba'}
            </button>
            <button type="button" onClick={() => { setStep('scan'); setWarehouse(null); setErr(''); }} className={btnGhost}>
              Ubah Gudang
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
