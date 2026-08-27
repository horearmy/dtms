'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Search } from 'lucide-react';
import AnimatedSection from './AnimatedSection';

export default function TrackingDemo() {
  const [resi, setResi] = useState('');

  return (
    <section className="bg-[#061B41] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <AnimatedSection>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">Coba Sekarang</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Lacak pengiriman secara publik
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-blue-100/80">
            Pelanggan Anda bisa memantau status pengiriman kapan saja tanpa perlu login.
          </p>
        </AnimatedSection>

        <AnimatedSection delay={0.1} className="mt-10">
          <form
            action="/tracking"
            method="GET"
            className="mx-auto flex max-w-lg flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                name="resi"
                value={resi}
                onChange={(e) => setResi(e.target.value)}
                placeholder="Masukkan nomor resi..."
                className="w-full rounded-xl border-0 bg-white py-4 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#16B364] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#149954]"
            >
              <Search size={18} />
              Lacak Pengiriman
            </motion.button>
          </form>
          <p className="mt-4 text-xs text-blue-200/60">
            Contoh format resi: DTMS-20260827-000016
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
