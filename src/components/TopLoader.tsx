'use client';

// Bar loading global: indikator saat data/route sedang dimuat dari sisi klien.
// Cara kerja: window.fetch di-patch untuk menghitung permintaan berjalan;
// transisi halaman App Router ikut tercakup karena memakai fetch juga.
// Bar baru tampil bila ada permintaan yang berjalan >250ms (polling cepat
// seperti GPS tidak membuatnya berkedip) dan minimal terlihat 500ms.
// Ada failsafe 15 detik agar bar tidak pernah nyangkut selamanya.

import { useEffect, useRef, useState } from 'react';

const REVEAL_DELAY_MS = 250;
const MIN_VISIBLE_MS = 500;
const FAILSAFE_MS = 15000;

const activeRef = { current: false };

export default function TopLoader() {
  const [active, setActive] = useState(false);
  const inFlight = useRef(0);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownAt = useRef(0);

  useEffect(() => {
    const clearTimers = () => {
      if (revealTimer.current) { clearTimeout(revealTimer.current); revealTimer.current = null; }
      if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    };

    const doHide = () => {
      activeRef.current = false;
      setActive(false);
      if (failsafeTimer.current) { clearTimeout(failsafeTimer.current); failsafeTimer.current = null; }
    };

    const hide = () => {
      // permintaan lain masih berjalan -> tetap tampil
      if (inFlight.current > 0) return;
      if (!activeRef.current && !revealTimer.current) return;
      const elapsed = Date.now() - shownAt.current;
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        hideTimer.current = null;
        if (inFlight.current === 0) doHide();
      }, wait);
    };

    const revealNow = () => {
      revealTimer.current = null;
      activeRef.current = true;
      shownAt.current = Date.now();
      setActive(true);
      if (failsafeTimer.current) clearTimeout(failsafeTimer.current);
      failsafeTimer.current = setTimeout(() => {
        failsafeTimer.current = null;
        inFlight.current = 0;
        doHide();
      }, FAILSAFE_MS);
    };

    const show = () => {
      if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
      if (revealTimer.current || activeRef.current) return;
      revealTimer.current = setTimeout(revealNow, REVEAL_DELAY_MS);
    };

    // --- pantau semua fetch dari sisi klien ---
    const origFetch = window.fetch.bind(window);
    const patchedFetch = (...args: Parameters<typeof fetch>) => {
      inFlight.current += 1;
      show();
      return origFetch(...args).finally(() => {
        inFlight.current = Math.max(0, inFlight.current - 1);
        hide();
      });
    };
    window.fetch = patchedFetch as typeof fetch;

    return () => {
      window.fetch = origFetch;
      clearTimers();
      if (failsafeTimer.current) clearTimeout(failsafeTimer.current);
      activeRef.current = false;
    };
     
  }, []);

  return (
    <div className={`dtms-toploader${active ? ' dtms-active' : ''}`} role="progressbar" aria-label="Memuat data">
      <div className="dtms-toploader-bar" />
    </div>
  );
}
