import type { Metadata } from 'next';
import HubList from './HubList';

export const metadata: Metadata = { title: 'Hub | DTMS' };

export default function HubsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#101828]">Hub</h2>
        <p className="text-sm text-[#667085]">Kelola titik pengumpulan dan distribusi (hub) per branch.</p>
      </div>
      <HubList />
    </div>
  );
}
