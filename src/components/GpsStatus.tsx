"use client";

import { useCallback, useEffect, useState } from 'react';

type GpsState = 'checking' | 'on' | 'off';

function probeGps(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(false);
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
    );
  });
}

export default function GpsStatus({ compact }: { compact?: boolean }) {
  const [state, setState] = useState<GpsState>('checking');
  const [detail, setDetail] = useState('Memeriksa status GPS...');
  const [alertVisible, setAlertVisible] = useState(false);
  const [showTip, setShowTip] = useState(false);

  const update = useCallback(async () => {
    const ok = await probeGps();
    setState(ok ? 'on' : 'off');
    if (ok) {
      setDetail(`GPS aktif · terakhir diperiksa ${new Date().toLocaleTimeString('id-ID')}`);
    } else {
      setDetail('GPS mati — aktifkan lokasi perangkat agar posisi terkirim');
    }
    setAlertVisible(!ok);
  }, []);

  useEffect(() => {
    update();
    const t = setInterval(update, 10000);
    return () => clearInterval(t);
  }, [update]);

  const on = state === 'on';
  const off = state === 'off';

  return (
    <>
      {/* Alert ketika GPS mati */}
      {off && alertVisible && (
        <div className="fixed left-1/2 top-2 z-[60] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-600 px-4 py-3 text-white shadow-lg">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg">📍</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">GPS Mati / Tidak Aktif</p>
              <p className="text-xs text-red-100">
                Aktifkan lokasi perangkat agar posisi paket dapat dikirim &amp; live tracking berjalan.
              </p>
            </div>
            <button
              onClick={() => { setAlertVisible(false); update(); }}
              className="shrink-0 rounded-lg bg-white/20 px-2 py-1 text-xs font-semibold hover:bg-white/30"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      <div className="relative">
        <button
          onClick={() => { setShowTip((v) => !v); update(); }}
          title={detail}
          aria-label={on ? 'GPS aktif' : off ? 'GPS mati' : 'Memeriksa GPS'}
          className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/40 shadow-md transition hover:scale-105"
          style={{
            background: on ? '#16B364' : off ? '#F5222D' : '#667085',
            boxShadow: on ? '0 0 0 4px rgba(22,179,100,.25)' : off ? '0 0 0 4px rgba(245,34,45,.25)' : 'none',
          }}
        >
          {on && <span className="absolute inset-0 animate-ping rounded-full bg-green-400 opacity-40" />}
          <span className="text-base leading-none">{on ? '📡' : off ? '⛔' : '…'}</span>
        </button>

        {!compact && (
          <div className="sr-only">{on ? 'GPS aktif' : off ? 'GPS mati' : 'Memeriksa GPS'}</div>
        )}

        {showTip && (
          <div className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-[#E4E7EC] bg-white p-3 text-xs text-[#101828] shadow-lg">
            <div className="mb-1 flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: on ? '#16B364' : off ? '#F5222D' : '#667085' }}
              />
              <b>{on ? 'GPS Aktif' : off ? 'GPS Mati' : 'Memeriksa…'}</b>
            </div>
            <p className="text-[#667085]">{detail}</p>
            <p className="mt-1 text-[11px] text-[#667085]">Status diperiksa otomatis tiap 10 detik.</p>
          </div>
        )}
      </div>
    </>
  );
}