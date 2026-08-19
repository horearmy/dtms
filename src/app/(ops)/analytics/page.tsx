export default function AnalyticsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 text-4xl">📊</div>
      <h2 className="text-lg font-bold text-gray-900">Analitik</h2>
      <p className="mt-2 max-w-md text-sm text-gray-500">
        Halaman analitik akan segera tersedia. Silakan gunakan halaman Laporan untuk melihat data operasional.
      </p>
      <a href="/reports" className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
        Buka Laporan
      </a>
    </div>
  );
}
