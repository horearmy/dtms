'use client';

import { motion } from 'framer-motion';
import { STATS } from '@/lib/landing-data';
import { ArrowRight, Play } from 'lucide-react';
import Image from 'next/image';

export default function HeroSection({ onLogin }: { onLogin: () => void }) {
  return (
    <section className="relative overflow-hidden bg-[#061B41] px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-20 lg:px-8">
      {/* Background gradients */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-blue-500/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[600px] w-[600px] rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-1.5 text-sm font-medium text-blue-100 backdrop-blur-sm"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
          </span>
          Live tracking untuk operasional logistik modern
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto max-w-4xl text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl"
        >
          Pantau Setiap Pengiriman
          <br />
          <span className="text-blue-300">secara Real-Time</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-blue-100/85"
        >
          DTMS menghubungkan armada, driver, dan gudang dalam satu dashboard live.
          Cocok untuk UMKM logistik hingga enterprise multi-cabang.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <a
            href="#demo"
            className="group flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-sm font-bold text-[#0D6EFD] shadow-lg shadow-blue-900/20 transition hover:bg-blue-50 hover:shadow-xl"
          >
            Minta Demo Gratis
            <ArrowRight size={18} className="transition group-hover:translate-x-1" />
          </a>
          <a
            href="/tracking"
            className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/5 px-8 py-4 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/10"
          >
            <Play size={18} className="fill-white" />
            Coba Live Tracking
          </a>
        </motion.div>

        {/* Hero Image */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mx-auto mt-16 max-w-5xl"
        >
          <div className="relative rounded-2xl border border-white/15 bg-[#0B2A5B]/80 p-2 shadow-2xl shadow-black/30 backdrop-blur sm:p-3">
            <div className="absolute -top-3 left-6 flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              LIVE
            </div>
            <div className="relative overflow-hidden rounded-xl">
              <Image
                src="/images/landing/shipment-dashboard.png"
                alt="DTMS Dashboard Live Tracking"
                width={1200}
                height={700}
                className="w-full rounded-xl"
                priority
              />
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-8 sm:grid-cols-4"
        >
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-white sm:text-4xl">{stat.value}</div>
              <div className="mt-1 text-sm text-blue-200/80">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
