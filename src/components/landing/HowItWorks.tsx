'use client';

import { motion } from 'framer-motion';
import { HOW_IT_WORKS } from '@/lib/landing-data';
import AnimatedSection from './AnimatedSection';

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <AnimatedSection className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0D6EFD]">How it works</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Dari order hingga delivery, tanpa blind spot
          </h2>
        </AnimatedSection>

        <div className="relative mt-14 grid gap-8 md:grid-cols-4">
          <div className="absolute left-[12%] right-[12%] top-6 hidden h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent md:block" />
          {HOW_IT_WORKS.map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative text-center"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-[#0D6EFD] text-xs font-bold text-white shadow-lg shadow-blue-200">
                {item.step}
              </div>
              <h3 className="mt-5 text-base font-bold text-gray-900">{item.title}</h3>
              <p className="mx-auto mt-2 max-w-[190px] text-sm leading-6 text-gray-500">{item.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
