import type { Metadata } from 'next';
import ControlTower from './ControlTower';

export const metadata: Metadata = { title: 'Control Tower | DTMS' };

export default function ControlTowerPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#101828]">Control Tower</h1>
        <p className="mt-1 text-sm text-[#667085]">Live operations monitoring dan KPI dashboard.</p>
      </div>
      <ControlTower />
    </div>
  );
}
