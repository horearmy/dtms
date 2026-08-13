"use client";

export default function CsvExport({ data, filename }: { data: string; filename: string }) {
  return (
    <button
      onClick={() => {
        const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }}
      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
    >
      ⬇ Ekspor CSV
    </button>
  );
}