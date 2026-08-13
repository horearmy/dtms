"use client";

import { useState } from 'react';

export default function GpsSender() {
  const [status, setStatus] = useState('');

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

  return (
    <button
      onClick={send}
      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
    >
      📡 Kirim Lokasi
      {status && <span className="ml-1 text-[10px]">{status}</span>}
    </button>
  );
}