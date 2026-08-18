import type { Metadata } from 'next';
import TrackingLookup from './TrackingLookup';

export const metadata: Metadata = { title: 'Lacak Pengiriman | DTMS' };

export default function TrackPage() {
  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <header className="border-b border-[#E4E7EC] bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div className="text-lg font-bold text-[#101828]">DTMS — Lacak Pengiriman</div>
          <a href="/login" className="text-sm font-medium text-[#0D6EFD] hover:underline">Login</a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <TrackingLookup />
      </main>
    </div>
  );
}
