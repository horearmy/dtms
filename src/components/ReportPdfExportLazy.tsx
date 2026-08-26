'use client';

import dynamic from 'next/dynamic';

const ReportPdfExport = dynamic(() => import('./ReportPdfExport'), {
  ssr: false,
  loading: () => (
    <div className="h-9 w-40 animate-pulse rounded-lg bg-[#F2F4F7]" aria-label="Memuat ekspor PDF" />
  ),
});

export default ReportPdfExport;
