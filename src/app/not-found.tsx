import Link from 'next/link';
import { Package } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F9FC] p-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0D6EFD]/10">
        <Package size={32} className="text-[#0D6EFD]" />
      </div>
      <div className="text-5xl font-bold text-[#101828]">404</div>
      <h1 className="mt-2 text-xl font-bold text-[#101828]">Tidak Ditemukan</h1>
      <p className="mt-1 text-sm text-[#667085]">Halaman yang Anda cari tidak ditemukan atau telah dipindahkan.</p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/tracking"
          className="rounded-lg bg-[#0D6EFD] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B5FD5]"
        >
          Cek Resi
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-[#E4E7EC] bg-white px-5 py-2.5 text-sm font-medium text-[#101828] transition hover:bg-[#F7F9FC]"
        >
          Masuk
        </Link>
      </div>
    </div>
  );
}
