"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TrackingSearch({ initial }: { initial?: string }) {
  const router = useRouter();
  const [resi, setResi] = useState(initial || '');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = resi.trim().toUpperCase();
    if (v) router.push(`/tracking/${encodeURIComponent(v)}`);
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full flex-col gap-3 rounded-2xl bg-white p-6 shadow-lg sm:flex-row"
    >
      <div className="flex-1">
        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#667085]">Nomor Resi</label>
        <input
          value={resi}
          onChange={(e) => setResi(e.target.value.toUpperCase())}
          placeholder="Contoh: DTMS-20260813-000001"
          className="w-full rounded-xl border border-[#E4E7EC] px-4 py-3 font-mono text-sm tracking-wide focus:border-[#0D6EFD] focus:outline-none"
        />
      </div>
      <button type="submit" className="self-end rounded-xl bg-[#0D6EFD] px-6 py-3 font-semibold text-white transition hover:bg-[#0B5FD5]">
        Lacak
      </button>
      <div className="sr-only">{initial && <Link href="/tracking">clear</Link>}</div>
    </form>
  );
}
