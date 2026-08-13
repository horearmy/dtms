"use client";

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function ShipmentQR({ value, size = 140 }: { value: string; size?: number }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(value, { width: size, margin: 1 })
      .then(setSrc)
      .catch(() => setSrc(''));
  }, [value, size]);

  if (!src) return <div style={{ width: size, height: size }} className="animate-pulse rounded-lg border border-slate-200 bg-slate-100" />;
  return <img src={src} width={size} height={size} alt="QR Resi" className="rounded-lg border border-slate-200" />;
}