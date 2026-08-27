'use client';

import { motion } from 'framer-motion';
import { CLIENT_LOGOS } from '@/lib/landing-data';
import AnimatedSection from './AnimatedSection';

export default function LogoCloud() {
  return (
    <section className="border-y border-gray-100 bg-white px-4 py-12 sm:px-6 lg:px-8">
      <AnimatedSection>
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-sm font-medium text-gray-500">
            Dipercaya oleh tim logistik di berbagai skala
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {CLIENT_LOGOS.map((logo, index) => (
              <motion.div
                key={logo.name}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5 transition hover:border-blue-200 hover:bg-blue-50/50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#061B41] text-xs font-bold text-white">
                  {logo.initials}
                </span>
                <span className="text-sm font-semibold text-gray-600 transition group-hover:text-[#0D6EFD]">
                  {logo.name}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>
    </section>
  );
}
