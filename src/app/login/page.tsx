import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, Boxes, ShieldCheck } from 'lucide-react';
import LoginForm from './LoginForm';

export const metadata: Metadata = { title: 'Masuk | DTMS' };

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#061B41] lg:grid lg:grid-cols-[minmax(420px,0.9fr)_minmax(520px,1.1fr)]">
      <section className="relative hidden overflow-hidden px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#0D6EFD]/20 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-[30rem] w-[30rem] rounded-full bg-[#13B8A6]/10 blur-3xl" />
        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1 shadow-lg shadow-black/10">
              <img src="/logo.png" alt="Logo DTMS" className="h-full w-full rounded-lg object-contain" />
            </span>
            <span>
              <span className="block text-xl font-bold tracking-tight">DTMS</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-200/70">Logistics intelligence</span>
            </span>
          </Link>
        </div>

        <div className="relative max-w-xl py-16">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.28em] text-[#7DD3FC]">The control layer for modern logistics</p>
          <h1 className="max-w-lg text-4xl font-semibold leading-[1.12] tracking-tight xl:text-5xl">
            Every shipment.<br />Every signal.<br /><span className="text-[#7DD3FC]">One clear view.</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-blue-100/70">
            Pantau pergerakan, koordinasikan tim, dan ambil keputusan lebih cepat dari satu platform operasional terpadu.
          </p>
          <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm">
              <Activity className="mb-5 h-5 w-5 text-[#7DD3FC]" />
              <p className="text-sm font-semibold">Real-time</p>
              <p className="mt-1 text-xs text-blue-100/55">Visibility</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm">
              <Boxes className="mb-5 h-5 w-5 text-[#7DD3FC]" />
              <p className="text-sm font-semibold">All-in-one</p>
              <p className="mt-1 text-xs text-blue-100/55">Operations</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm">
              <ShieldCheck className="mb-5 h-5 w-5 text-[#7DD3FC]" />
              <p className="text-sm font-semibold">Secure</p>
              <p className="mt-1 text-xs text-blue-100/55">By design</p>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-blue-100/45">© {new Date().getFullYear()} DTMS. Built for teams that move.</p>
      </section>

      <main className="relative flex min-h-screen items-center justify-center bg-[#F7F9FC] px-4 py-10 sm:px-8 lg:px-12 xl:px-20">
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-[#DCEBFF] opacity-70 blur-3xl" />
        <div className="relative w-full max-w-[460px]">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1 shadow-sm">
                <img src="/logo.png" alt="Logo DTMS" className="h-full w-full rounded-lg object-contain" />
              </span>
              <span>
                <span className="block text-lg font-bold tracking-tight text-[#061B41]">DTMS</span>
                <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-[#667085]">Logistics intelligence</span>
              </span>
            </Link>
          </div>
          <LoginForm />
        </div>
      </main>
      <Link
        href="/admin/secure-login"
        className="absolute bottom-4 right-5 text-xs text-[#98A2B3] transition hover:text-[#344054] lg:right-8"
      >
        Portal Admin
      </Link>
    </div>
  );
}
