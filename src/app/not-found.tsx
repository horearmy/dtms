import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-4 text-center">
      <div className="text-5xl font-bold text-brand-600">404</div>
      <h1 className="mt-2 text-xl font-bold text-slate-900">Tidak Ditemukan</h1>
      <p className="mt-1 text-sm text-slate-500">Nomor resi atau halaman yang Anda cari tidak ditemukan.</p>
      <div className="mt-4 flex gap-3">
        <Link href="/tracking" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Cek Resi Lain
        </Link>
        <Link href="/login" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Masuk
        </Link>
      </div>
    </div>
  );
}