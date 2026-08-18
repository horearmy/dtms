import type { Metadata } from 'next';
import SlaPolicies from './SlaPolicies';

export const metadata: Metadata = { title: 'SLA Policies | DTMS' };

export default function SlaPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#101828]">SLA Policies</h1>
        <p className="mt-1 text-sm text-[#667085]">Konfigurasi SLA target per layanan dan rute.</p>
      </div>
      <SlaPolicies />
    </div>
  );
}
