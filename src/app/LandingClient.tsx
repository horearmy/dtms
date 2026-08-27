'use client';

import { Suspense, lazy, useEffect, useState } from 'react';
import { FEATURES, STATS, PRICING_PLANS } from '@/lib/landing-data';
import DemoRequestForm from './DemoRequestForm';

const LoginModal = lazy(() => import('./LoginModal'));

const GALLERY_SLIDES = [
  { eyebrow: '01 / VISIBILITY', title: 'Semua armada dalam satu pandangan.', text: 'Pantau posisi kendaraan, status pengiriman, dan ETA tanpa berpindah tools.', accent: 'from-blue-600 to-cyan-400', metric: '1,284', label: 'pengiriman aktif' },
  { eyebrow: '02 / CONTROL', title: 'Exception terlihat sebelum terlambat.', text: 'Identifikasi SLA risk, keterlambatan, dan anomali operasional dengan cepat.', accent: 'from-violet-600 to-fuchsia-400', metric: '94.8%', label: 'on-time delivery' },
  { eyebrow: '03 / INTELLIGENCE', title: 'Data operasional menjadi keputusan.', text: 'Baca performa delivery, fleet, dan driver melalui insight yang siap ditindaklanjuti.', accent: 'from-emerald-600 to-lime-400', metric: '24/7', label: 'operational visibility' },
];

export default function LandingClient() {
  const [showLogin, setShowLogin] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActiveSlide((current) => (current + 1) % GALLERY_SLIDES.length), 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#061B41]/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo DTMS" className="h-10 w-10 rounded-xl bg-white object-contain p-0.5" />
            <div><span className="block text-xl font-bold tracking-tight text-white">DTMS</span><span className="hidden text-[9px] font-semibold uppercase tracking-[0.2em] text-blue-200/70 sm:block">Logistics intelligence</span></div>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#platform" className="text-sm font-medium text-blue-100/70 transition hover:text-white">Platform</a>
            <a href="#features" className="text-sm font-medium text-blue-100/70 transition hover:text-white">Fitur</a>
            <a href="#pricing" className="text-sm font-medium text-blue-100/70 transition hover:text-white">Harga</a>
            <a href="#demo" className="text-sm font-medium text-blue-100/70 transition hover:text-white">Demo</a>
            <button
              onClick={() => setShowLogin(true)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#061B41] transition hover:bg-blue-50"
            >
              Masuk
            </button>
          </div>
          <button className="md:hidden" aria-label="Menu">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </nav>

      <section className="relative overflow-hidden bg-[#061B41] px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-white/20" />
          <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-white/10" />
        </div>
        <div className="relative mx-auto max-w-7xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-1.5 text-sm font-medium text-blue-100 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            Satu pusat kendali untuk operasional logistik
          </div>
          <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-7xl">
            Setiap pengiriman,
            <br />
            <span className="text-blue-300">lebih terkendali.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-blue-100/90">
            DTMS menyatukan tracking real-time, armada, warehouse, SLA, dan insight bisnis dalam satu workspace yang dibuat untuk tim logistik modern.
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
          <div className="mx-auto mt-14 max-w-4xl rounded-2xl border border-white/15 bg-[#0B2A5B]/80 p-3 text-left shadow-2xl shadow-black/20 backdrop-blur sm:p-4">
            <div className="flex items-center justify-between border-b border-white/10 px-2 pb-3">
              <div><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-blue-200/55">Operations overview</p><p className="mt-1 text-sm font-semibold text-white">Control Tower</p></div>
              <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">● Live</span>
            </div>
            <div className="grid gap-3 p-2 sm:grid-cols-3">
              {['1,284 Active shipments', '94.8% On-time rate', '18 Open exceptions'].map((item, index) => {
                const [value, ...label] = item.split(' ');
                return <div key={item} className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-lg font-bold text-white">{value}</p><p className="mt-1 text-[10px] text-blue-100/55">{label.join(' ')}</p><div className={`mt-3 h-1 rounded-full ${index === 2 ? 'w-1/3 bg-amber-400' : 'w-4/5 bg-emerald-400'}`} /></div>;
              })}
            </div>
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

      <section aria-label="Product gallery" className="bg-[#F7F9FC] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0D6EFD]">Explore DTMS</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Dibuat untuk melihat lebih jauh.</h2></div>
            <div className="flex items-center gap-2" aria-label="Gallery navigation">
              {GALLERY_SLIDES.map((slide, index) => <button key={slide.eyebrow} type="button" aria-label={`Lihat slide ${index + 1}`} aria-current={activeSlide === index} onClick={() => setActiveSlide(index)} className={`h-2 rounded-full transition-all ${activeSlide === index ? 'w-8 bg-[#0D6EFD]' : 'w-2 bg-gray-300 hover:bg-gray-400'}`} />)}
            </div>
          </div>
          <div className="relative overflow-hidden rounded-3xl bg-[#061B41] shadow-xl shadow-blue-100/60">
            {GALLERY_SLIDES.map((slide, index) => (
              <div key={slide.eyebrow} className={`${activeSlide === index ? 'grid' : 'hidden'} min-h-[320px] items-center gap-10 p-7 sm:p-12 lg:grid-cols-[0.8fr_1.2fr]`}>
                <div className="text-white"><p className="text-xs font-bold tracking-[0.2em] text-blue-300">{slide.eyebrow}</p><h3 className="mt-4 max-w-md text-3xl font-bold leading-tight sm:text-4xl">{slide.title}</h3><p className="mt-4 max-w-md leading-7 text-blue-100/70">{slide.text}</p><a href="#demo" className="mt-7 inline-flex rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-[#061B41] hover:bg-blue-50">Lihat cara kerja</a></div>
                <div className="relative rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm sm:p-6"><div className="flex items-center justify-between border-b border-white/10 pb-4"><span className="text-xs font-semibold text-white/70">DTMS / {slide.eyebrow.split(' / ')[1]}</span><span className="text-[10px] text-emerald-300">● LIVE</span></div><div className="mt-5 flex items-end justify-between gap-5"><div><p className="text-5xl font-extrabold text-white sm:text-6xl">{slide.metric}</p><p className="mt-2 text-sm text-blue-100/60">{slide.label}</p></div><div className={`h-28 w-28 rounded-full bg-gradient-to-br ${slide.accent} opacity-90 blur-[1px] sm:h-36 sm:w-36`} /></div><div className="mt-7 grid grid-cols-4 items-end gap-2">{[42, 66, 54, 78, 62, 86, 72, 94].map((height, barIndex) => <div key={barIndex} className="rounded-t bg-white/50" style={{ height: `${height}px` }} />)}</div></div>
              </div>
            ))}
            <div className="absolute bottom-5 right-6 flex gap-2"><button type="button" aria-label="Slide sebelumnya" onClick={() => setActiveSlide((activeSlide - 1 + GALLERY_SLIDES.length) % GALLERY_SLIDES.length)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10">←</button><button type="button" aria-label="Slide berikutnya" onClick={() => setActiveSlide((activeSlide + 1) % GALLERY_SLIDES.length)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10">→</button></div>
          </div>
        </div>
      </section>

      <section id="platform" className="scroll-mt-20 bg-[#F7F9FC] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0D6EFD]">Platform overview</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Satu platform. Visibilitas penuh.</h2>
            <p className="mt-4 text-gray-500">Hubungkan seluruh proses delivery dalam satu sumber data yang dapat dipantau, diukur, dan ditingkatkan.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { number: '01', title: 'Fleet', text: 'Pantau kendaraan, driver, status, utilisasi, dan maintenance.' },
              { number: '02', title: 'Delivery', text: 'Kelola order, dispatch, route, ETA, status, dan SLA.' },
              { number: '03', title: 'Intelligence', text: 'Ubah data operasional menjadi KPI, forecast, dan rekomendasi.' },
              { number: '04', title: 'Control', text: 'Kelola tenant, permission, audit, dan integrasi enterprise.' },
            ].map((item) => (
              <div key={item.number} className="group rounded-2xl border border-gray-200 bg-white p-6 transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/50">
                <span className="text-xs font-bold text-[#0D6EFD]">{item.number}</span>
                <h3 className="mt-8 text-lg font-bold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-500">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0D6EFD]">How it works</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Dari order hingga delivery, tanpa blind spot.</h2>
          </div>
          <div className="relative mt-14 grid gap-8 md:grid-cols-4">
            <div className="absolute left-[12%] right-[12%] top-6 hidden h-px bg-blue-100 md:block" />
            {[
              { step: '01', title: 'Plan', text: 'Masukkan order dan tetapkan tujuan delivery.' },
              { step: '02', title: 'Dispatch', text: 'Assign driver dan rute sesuai kapasitas.' },
              { step: '03', title: 'Monitor', text: 'Pantau posisi, ETA, SLA, dan exception real-time.' },
              { step: '04', title: 'Improve', text: 'Analisis performa untuk keputusan yang lebih baik.' },
            ].map((item) => (
              <div key={item.step} className="relative text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-[#0D6EFD] text-xs font-bold text-white shadow-lg shadow-blue-200">{item.step}</div>
                <h3 className="mt-5 text-base font-bold text-gray-900">{item.title}</h3>
                <p className="mx-auto mt-2 max-w-[190px] text-sm leading-6 text-gray-500">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#061B41] px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">Enterprise ready</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Dibangun untuk operasi yang terus berkembang.</h2>
            <p className="mt-5 max-w-xl leading-7 text-blue-100/70">Mulai dari satu tim hingga jaringan multi-tenant, DTMS menjaga kontrol, keamanan, dan visibilitas tetap terukur.</p>
            <a href="#demo" className="mt-8 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#061B41] transition hover:bg-blue-50">Diskusikan kebutuhan Anda</a>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {['Multi-tenant architecture', 'RBAC, 2FA & audit trail', 'API & webhook ready', 'Scalable operational analytics'].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-medium text-blue-50">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">✓</span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-20 px-4 py-20 sm:px-6 lg:px-8">
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

      <section id="pricing" className="scroll-mt-20 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Harga yang Fleksibel</h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-500">
              Mulai gratis, upgrade sesuai kebutuhan. Tidak ada biaya tersembunyi.
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {PRICING_PLANS.map((plan) => (
              <div
                key={plan.name}
                  className={`relative overflow-hidden rounded-2xl border-2 p-6 transition hover:-translate-y-1 xl:p-8 ${
                   plan.code === 'FREE' ? 'border-slate-200 bg-slate-50 hover:border-slate-400' :
                     plan.code === 'STARTER' ? 'border-cyan-200 bg-cyan-50/60 hover:border-cyan-400' :
                       plan.code === 'GROWTH' ? 'border-blue-500 bg-gradient-to-b from-blue-50 to-white shadow-lg shadow-blue-100' :
                         plan.code === 'PRO' ? 'border-violet-200 bg-violet-50/50 hover:border-violet-400' :
                           'border-amber-200 bg-gradient-to-b from-amber-50 to-white hover:border-amber-400'
                 }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#0D6EFD] px-4 py-1 text-xs font-semibold text-white">
                    Paling Populer
                  </div>
                )}
                 <div className="mb-4 flex items-center justify-between gap-2">
                   <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                   <span className={`h-2.5 w-2.5 rounded-full ${
                     plan.code === 'FREE' ? 'bg-slate-400' : plan.code === 'STARTER' ? 'bg-cyan-500' : plan.code === 'GROWTH' ? 'bg-blue-600' : plan.code === 'PRO' ? 'bg-violet-500' : 'bg-amber-500'
                   }`} />
                 </div>
                <p className="mt-2 text-sm text-gray-500">{plan.description}</p>
                <div className="mt-6">
                  <span className="text-3xl font-extrabold text-gray-900 xl:text-4xl">{plan.price}</span>
                  {plan.period && <span className="text-sm text-gray-500">/{plan.period}</span>}
                </div>
                <ul className="mt-6 space-y-2 xl:mt-8 xl:space-y-3">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-3 text-sm text-gray-600">
                       <svg className={`h-4 w-4 flex-shrink-0 ${plan.code === 'FREE' ? 'text-slate-500' : plan.code === 'STARTER' ? 'text-cyan-600' : plan.code === 'GROWTH' ? 'text-blue-600' : plan.code === 'PRO' ? 'text-violet-600' : 'text-amber-600'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feat}
                    </li>
                  ))}
                </ul>
                <a
                  href="#demo"
                  className={`mt-6 block w-full rounded-xl py-3 text-center text-sm font-semibold transition xl:mt-8 ${
                     plan.code === 'GROWTH'
                       ? 'bg-[#0D6EFD] text-white hover:bg-[#0B5FD5]'
                       : plan.code === 'STARTER' ? 'border border-cyan-300 bg-white text-cyan-700 hover:bg-cyan-100' : plan.code === 'PRO' ? 'border border-violet-300 bg-white text-violet-700 hover:bg-violet-100' : plan.code === 'ENTERPRISE' ? 'border border-amber-300 bg-white text-amber-700 hover:bg-amber-100' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="demo" className="scroll-mt-20 bg-gray-50 px-4 py-20 sm:px-6 lg:px-8">
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
                <img src="/logo.png" alt="Logo DTMS" className="h-8 w-8 rounded-lg object-contain" />
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
                <li><button onClick={() => setShowLogin(true)} className="hover:text-gray-700">Masuk</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Perusahaan</h4>
              <ul className="mt-3 space-y-2 text-sm text-gray-500">
                <li><a href="/tentang" className="hover:text-gray-700">Tentang Kami</a></li>
                <li><a href="/blog" className="hover:text-gray-700">Blog</a></li>
                <li><a href="/karir" className="hover:text-gray-700">Karir</a></li>
                <li><a href="mailto:hello@dtms.co.id" className="hover:text-gray-700">Kontak</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Legal</h4>
              <ul className="mt-3 space-y-2 text-sm text-gray-500">
                <li><a href="/kebijakan-privasi" className="hover:text-gray-700">Kebijakan Privasi</a></li>
                <li><a href="/syarat-ketentuan" className="hover:text-gray-700">Syarat & Ketentuan</a></li>
                <li><a href="/sla" className="hover:text-gray-700">SLA</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-gray-100 pt-6 text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} DTMS. All rights reserved.
          </div>
        </div>
      </footer>

      {showLogin && (
        <Suspense>
          <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />
        </Suspense>
      )}
    </div>
  );
}
