import type { Metadata } from 'next';
import Link from 'next/link';
import { FEATURES, STATS, PRICING_PLANS } from '@/lib/landing-data';
import DemoRequestForm from './DemoRequestForm';

export const metadata: Metadata = {
  title: 'DTMS - Delivery Tracking & Management System',
  description: 'Sistem manajemen pengiriman terlengkap. Lacak pengiriman real-time, kelola armada, optimasi rute, dan tingkatkan layanan Anda.',
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0D6EFD] text-lg font-bold text-white">
              DT
            </div>
            <span className="text-xl font-bold text-gray-900">DTMS</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900">Fitur</a>
            <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900">Harga</a>
            <a href="#demo" className="text-sm font-medium text-gray-600 hover:text-gray-900">Demo</a>
            <Link
              href="/login"
              className="rounded-lg bg-[#0D6EFD] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0B5FD5]"
            >
              Masuk
            </Link>
          </div>
          <button className="md:hidden" aria-label="Menu">
            <svg className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </nav>

      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-white/20" />
          <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-white/10" />
        </div>
        <div className="relative mx-auto max-w-7xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            Trusted by 200+ perusahaan logistik
          </div>
          <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Kelola Pengiriman
            <br />
            <span className="text-blue-200">Lebih Cerdas & Efisien</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-blue-100/90">
            Satu platform untuk tracking real-time, manajemen armada, optimasi rute, dan analitik mendalam.
            Dirancang untuk korporasi logistik modern.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#demo"
              className="rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-[#0D6EFD] shadow-lg transition hover:bg-blue-50 hover:shadow-xl"
            >
              Minta Demo Gratis
            </a>
            <a
              href="/tracking"
              className="rounded-xl border border-white/30 px-8 py-3.5 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Coba Tracking
            </a>
          </div>
          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-white sm:text-3xl">{stat.value}</div>
                <div className="mt-1 text-xs text-blue-200/80">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Fitur Lengkap untuk Logistik Modern</h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-500">
              Dari pickup hingga delivery, semua terkontrol dalam satu platform terintegrasi.
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:border-[#E8F0FE] hover:shadow-md"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8F0FE] text-xl transition group-hover:bg-[#E8F0FE]">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Live Tracking Map</h2>
              <p className="mt-4 text-gray-500">
                Pantau posisi semua driver dan armada secara real-time. Geofencing otomatis, rute teroptimasi via OSRM, dan notifikasi instan.
              </p>
              <ul className="mt-6 space-y-3">
                {['Real-time GPS setiap 15 detik', 'Geofencing otomatis masuk/keluar area', 'Rute teroptimasi dengan OSRM', 'Pantau kecepatan & baterai driver'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-gray-600">
                    <svg className="h-5 w-5 flex-shrink-0 text-[#0D6EFD]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
                <span className="ml-2 text-xs text-gray-400">Live Map</span>
              </div>
              <div className="flex h-64 items-center justify-center bg-gradient-to-br from-blue-50 to-green-50">
                <div className="text-center">
                  <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F0FE]">
                    <svg className="h-8 w-8 text-[#0D6EFD]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-500">Peta Tracking Real-Time</p>
                  <p className="mt-1 text-xs text-gray-400">Leaflet + OpenStreetMap</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Harga yang Fleksibel</h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-500">
              Mulai gratis, upgrade sesuai kebutuhan. Tidak ada biaya tersembunyi.
            </p>
          </div>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {PRICING_PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border-2 p-8 transition ${
                  plan.popular
                    ? 'border-[#0D6EFD] shadow-lg'
                    : 'border-[#E4E7EC] hover:border-[#0D6EFD]'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#0D6EFD] px-4 py-1 text-xs font-semibold text-white">
                    Paling Populer
                  </div>
                )}
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="mt-2 text-sm text-gray-500">{plan.description}</p>
                <div className="mt-6">
                  <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                  {plan.period && <span className="text-sm text-gray-500">/{plan.period}</span>}
                </div>
                <ul className="mt-8 space-y-3">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-3 text-sm text-gray-600">
                      <svg className="h-4 w-4 flex-shrink-0 text-[#0D6EFD]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feat}
                    </li>
                  ))}
                </ul>
                <a
                  href="#demo"
                  className={`mt-8 block w-full rounded-xl py-3 text-center text-sm font-semibold transition ${
                    plan.popular
                      ? 'bg-[#0D6EFD] text-white hover:bg-[#0B5FD5]'
                      : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="demo" className="bg-gray-50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Minta Demo Gratis</h2>
              <p className="mt-4 text-gray-500">
                Isi formulir di samping dan tim kami akan menghubungi Anda dalam 1×24 jam untuk demo personal dan konsultasi kebutuhan bisnis Anda.
              </p>
              <div className="mt-8 space-y-4">
                {['Setup gratis tanpa biaya', 'Konsultasi kebutuhan bisnis', 'Trial 14 hari fitur lengkap', 'Dedicated customer success'].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E8F0FE]">
                      <svg className="h-3.5 w-3.5 text-[#0D6EFD]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <DemoRequestForm />
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 bg-white px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D6EFD] text-xs font-bold text-white">
                  DT
                </div>
                <span className="text-lg font-bold text-gray-900">DTMS</span>
              </div>
              <p className="mt-3 text-sm text-gray-500">
                Sistem manajemen pengiriman terlengkap untuk korporasi logistik modern.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Produk</h4>
              <ul className="mt-3 space-y-2 text-sm text-gray-500">
                <li><a href="#features" className="hover:text-gray-700">Fitur</a></li>
                <li><a href="#pricing" className="hover:text-gray-700">Harga</a></li>
                <li><a href="/tracking" className="hover:text-gray-700">Tracking Publik</a></li>
                <li><a href="/login" className="hover:text-gray-700">Masuk</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Perusahaan</h4>
              <ul className="mt-3 space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-gray-700">Tentang Kami</a></li>
                <li><a href="#" className="hover:text-gray-700">Blog</a></li>
                <li><a href="#" className="hover:text-gray-700">Karir</a></li>
                <li><a href="#" className="hover:text-gray-700">Kontak</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Legal</h4>
              <ul className="mt-3 space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-gray-700">Kebijakan Privasi</a></li>
                <li><a href="#" className="hover:text-gray-700">Syarat & Ketentuan</a></li>
                <li><a href="#" className="hover:text-gray-700">SLA</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-gray-100 pt-6 text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} DTMS. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
