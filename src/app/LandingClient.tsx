'use client';

import { Suspense, lazy, useState } from 'react';
import Link from 'next/link';
import { PRICING_PLANS } from '@/lib/landing-data';
import DemoRequestForm from './DemoRequestForm';
import HeroSection from '@/components/landing/HeroSection';
import LogoCloud from '@/components/landing/LogoCloud';
import LiveTrackingShowcase from '@/components/landing/LiveTrackingShowcase';
import HowItWorks from '@/components/landing/HowItWorks';
import FeatureGrid from '@/components/landing/FeatureGrid';
import TrackingDemo from '@/components/landing/TrackingDemo';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import FAQSection from '@/components/landing/FAQSection';
import MobileMenu from '@/components/landing/MobileMenu';
import AnimatedSection from '@/components/landing/AnimatedSection';
import { motion } from 'framer-motion';

const LoginModal = lazy(() => import('./LoginModal'));

export default function LandingClient() {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky Navigation */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#061B41]/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo DTMS" className="h-10 w-10 rounded-xl bg-white object-contain p-0.5" />
            <div>
              <span className="block text-xl font-bold tracking-tight text-white">DTMS</span>
              <span className="hidden text-[9px] font-semibold uppercase tracking-[0.2em] text-blue-200/70 sm:block">
                Logistics intelligence
              </span>
            </div>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#platform" className="text-sm font-medium text-blue-100/70 transition hover:text-white">Platform</a>
            <a href="#live-tracking" className="text-sm font-medium text-blue-100/70 transition hover:text-white">Live Tracking</a>
            <a href="#features" className="text-sm font-medium text-blue-100/70 transition hover:text-white">Fitur</a>
            <a href="#pricing" className="text-sm font-medium text-blue-100/70 transition hover:text-white">Harga</a>
            <a href="#faq" className="text-sm font-medium text-blue-100/70 transition hover:text-white">FAQ</a>
            <a href="#demo" className="text-sm font-medium text-blue-100/70 transition hover:text-white">Demo</a>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <a
              href="/tracking"
              className="rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Coba Tracking
            </a>
            <button
              onClick={() => setShowLogin(true)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#061B41] transition hover:bg-blue-50"
            >
              Masuk
            </button>
          </div>
          <MobileMenu onLogin={() => setShowLogin(true)} />
        </div>
      </nav>

      <HeroSection onLogin={() => setShowLogin(true)} />
      <LogoCloud />

      {/* Platform Overview */}
      <section id="platform" className="scroll-mt-20 bg-[#F7F9FC] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <AnimatedSection className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0D6EFD]">Platform overview</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Satu platform. Visibilitas penuh.</h2>
            <p className="mt-4 text-gray-500">
              Hubungkan seluruh proses delivery dalam satu sumber data yang dapat dipantau, diukur, dan ditingkatkan.
            </p>
          </AnimatedSection>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { number: '01', title: 'Fleet', text: 'Pantau kendaraan, driver, status, utilisasi, dan maintenance.' },
              { number: '02', title: 'Delivery', text: 'Kelola order, dispatch, route, ETA, status, dan SLA.' },
              { number: '03', title: 'Intelligence', text: 'Ubah data operasional menjadi KPI, forecast, dan rekomendasi.' },
              { number: '04', title: 'Control', text: 'Kelola tenant, permission, audit, dan integrasi enterprise.' },
            ].map((item, index) => (
              <motion.div
                key={item.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -4 }}
                className="group rounded-2xl border border-gray-200 bg-white p-6 transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/50"
              >
                <span className="text-xs font-bold text-[#0D6EFD]">{item.number}</span>
                <h3 className="mt-8 text-lg font-bold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-500">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <LiveTrackingShowcase />
      <HowItWorks />
      <FeatureGrid />
      <TrackingDemo />
      <TestimonialsSection />

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <AnimatedSection className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0D6EFD]">Harga</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Harga yang Fleksibel</h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-500">
              Mulai gratis, upgrade sesuai kebutuhan. Tidak ada biaya tersembunyi.
            </p>
          </AnimatedSection>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {PRICING_PLANS.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -4 }}
                className={`relative overflow-hidden rounded-2xl border-2 p-6 transition xl:p-8 ${
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
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <FAQSection />

      {/* Demo CTA */}
      <section id="demo" className="scroll-mt-20 bg-gray-50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <AnimatedSection>
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
            </AnimatedSection>
            <AnimatedSection delay={0.1}>
              <DemoRequestForm />
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Footer */}
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
