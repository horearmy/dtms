import type { Metadata } from 'next';
import ExceptionsList from './ExceptionsList';

export const metadata: Metadata = { title: 'Exceptions | DTMS' };

export default function ExceptionsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#101828]">Exception Management</h1>
        <p className="mt-1 text-sm text-[#667085]">Pantau dan selesaikan masalah pengiriman.</p>
      </div>
      <ExceptionsList />
    </div>
  );
}
