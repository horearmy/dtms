"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SearchBox({ placeholder = 'Cari nomor resi...' }: { placeholder?: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/shipments?q=${encodeURIComponent(q.trim())}`);
      }}
      className="flex-1 max-w-md"
    >
      <div className="relative">
        <svg className="absolute left-3 top-2.5 h-4 w-4 text-[#667085]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-[#E4E7EC] bg-white py-2 pl-9 pr-3 text-sm focus:border-[#0D6EFD] focus:outline-none"
        />
      </div>
    </form>
  );
}