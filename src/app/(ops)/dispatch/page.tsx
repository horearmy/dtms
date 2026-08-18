import type { Metadata } from 'next';
import DispatchBoard from './DispatchBoard';

export const metadata: Metadata = { title: 'Dispatch Board | DTMS' };

export default function DispatchPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#101828]">Dispatch Board</h1>
        <p className="mt-1 text-sm text-[#667085]">Kelola penugasan driver dan kendaraan ke pengiriman.</p>
      </div>
      <DispatchBoard />
    </div>
  );
}
