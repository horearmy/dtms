import type { Metadata } from 'next';
import DepartmentList from './DepartmentList';

export const metadata: Metadata = { title: 'Departemen | DTMS' };

export default function DepartmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#101828]">Departemen</h2>
        <p className="text-sm text-[#667085]">Kelola departemen di bawah organization dan branch.</p>
      </div>
      <DepartmentList />
    </div>
  );
}
