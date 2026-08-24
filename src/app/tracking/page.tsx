import type { Metadata } from 'next';
import TrackingSearch from './TrackingSearch';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = { title: 'Lacak Kiriman | DTMS' };
export const dynamic = 'force-dynamic';

export default async function TrackingPage() {
  const samples = await prisma.shipment.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#061B41] via-[#0B2A5B] to-[#0D6EFD] p-4">
      <div className="mb-6 text-center text-white">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold">📦</div>
        <h1 className="text-2xl font-bold">Delivery Tracking Management System</h1>
        <p className="mt-1 text-sm text-white/70">Lacak status pengiriman Anda dengan nomor resi</p>
      </div>

      <div className="w-full max-w-xl">
        <TrackingSearch />
      </div>

      <div className="mt-6 w-full max-w-xl rounded-xl bg-white/10 p-4 text-xs text-white/90">
        <div className="mb-2 font-semibold">Contoh nomor resi untuk demo:</div>
        <div className="flex flex-wrap gap-2">
          {samples.map((s) => (
            <a key={s.id} href={`/tracking/${s.trackingNumber}`} className="rounded-lg bg-white/20 px-2 py-1 font-mono hover:bg-white/30">
              {s.trackingNumber}
            </a>
          ))}
        </div>
      </div>

      <a href="/login" className="mt-8 text-xs text-white/70 underline hover:text-white">Masuk untuk staf</a>
    </div>
  );
}
