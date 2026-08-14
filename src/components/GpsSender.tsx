"use client";

import { useEffect, useRef, useState } from 'react';

export default function GpsSender() {
  const [status, setStatus] = useState('');
  const [auto, setAuto] = useState(false);
  const autoRef = useRef(auto);
  autoRef.current = auto;

  async function postGPS(lat: number, lng: number, speed?: number | null, accuracy?: number | null) {
    try {
      setStatus('Mengirim lokasi...');
      const res = await fetch('/api/gps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng, speed, accuracy }),
      });
      setStatus(res.ok ? 'Lokasi terkirim ✓' : 'Gagal mengirim');
    } catch {
      setStatus('Gagal mengirim');
    }
    setTimeout(() => setStatus(''), 3000);
  }

  async function send() {
    setStatus('Mencari lokasi...');
    const useMock = () => {
      const lat = -6.2 + (Math.random() - 0.5) * 0.05;
      const lng = 106.816 + (Math.random() - 0.5) * 0.05;
      return postGPS(lat, lng);
    };

    if (!navigator.geolocation) {
      await useMock();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await postGPS(pos.coords.latitude, pos.coords.longitude, pos.coords.speed, pos.coords.accuracy);
      },
      async () => {
        await useMock();
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  useEffect(() => {
    if (!auto) return;
    send();
    const t = setInterval(send, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return (
    <div className="flex items-center gap-2">
      <label className="flex cursor-pointer select-none items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-2 py-1.5 text-[11px] font-semibold text-white" title="Kirim lokasi otomatis tiap 15 detik untuk live tracking">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="h-3.5 w-3.5 accent-emerald-400" />
        Auto GPS
      </label>
      <button
        onClick={send}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition ${auto ? 'bg-emerald-400 text-emerald-900' : 'bg-emerald-500 hover:bg-emerald-600'}`}
      >
        📡 Kirim Lokasi
        {status && <span className="ml-1 text-[10px]">{status}</span>}
      </button>
    </div>
  );
}