'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LIVE_TRACKING_TABS } from '@/lib/landing-data';
import { Check } from 'lucide-react';
import Image from 'next/image';
import AnimatedSection from './AnimatedSection';

export default function LiveTrackingShowcase() {
  const [activeTab, setActiveTab] = useState(0);
  const tab = LIVE_TRACKING_TABS[activeTab];

  return (
    <section id="live-tracking" className="scroll-mt-20 bg-[#F7F9FC] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <AnimatedSection className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0D6EFD]">Live Tracking</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Visibilitas penuh dari gudang hingga tujuan
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-500">
            Pantau armada, driver, dan pengiriman secara real-time dalam satu platform terintegrasi.
          </p>
        </AnimatedSection>

        <AnimatedSection delay={0.1} className="mt-12">
          {/* Tabs */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {LIVE_TRACKING_TABS.map((t, index) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(index)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition sm:px-5 ${
                  activeTab === index
                    ? 'bg-[#0D6EFD] text-white shadow-md shadow-blue-200'
                    : 'bg-white text-gray-600 hover:bg-gray-50 hover:text-[#0D6EFD]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </AnimatedSection>

        <div className="mt-10 grid items-center gap-10 lg:grid-cols-2">
          {/* Text content */}
          <AnimatedSection delay={0.2}>
            <AnimatePresence mode="wait">
              <motion.div
                key={tab.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <h3 className="text-2xl font-bold text-gray-900 sm:text-3xl">{tab.title}</h3>
                <p className="mt-4 text-base leading-7 text-gray-500">{tab.description}</p>
                <ul className="mt-6 space-y-3">
                  {tab.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-center gap-3 text-sm text-gray-700">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      {highlight}
                    </li>
                  ))}
                </ul>
                <a
                  href="#demo"
                  className="mt-8 inline-flex rounded-xl bg-[#0D6EFD] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#0B5FD5]"
                >
                  Pelajari Lebih Lanjut
                </a>
              </motion.div>
            </AnimatePresence>
          </AnimatedSection>

          {/* Image */}
          <AnimatedSection delay={0.3}>
            <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-xl shadow-blue-100/50">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.4 }}
                >
                  <Image
                    src={tab.image}
                    alt={tab.title}
                    width={700}
                    height={450}
                    className="w-full rounded-xl"
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
