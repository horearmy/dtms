'use client';

export default function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm text-[#667085]">
      <span>Menampilkan {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} dari {total}</span>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)}
          className="rounded px-2 py-1 text-xs font-semibold hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300">
          &laquo;
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`e${i}`} className="px-1 text-[#667085]">...</span>
          ) : (
            <button key={p} onClick={() => onChange(p)}
              className={`min-w-[28px] rounded px-2 py-1 text-xs font-semibold ${p === page ? 'bg-[#0D6EFD] text-white' : 'hover:bg-gray-100'}`}>
              {p}
            </button>
          )
        )}
        <button disabled={page >= totalPages} onClick={() => onChange(page + 1)}
          className="rounded px-2 py-1 text-xs font-semibold hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300">
          &raquo;
        </button>
      </div>
    </div>
  );
}
