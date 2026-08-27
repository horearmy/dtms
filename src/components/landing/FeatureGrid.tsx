'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FEATURE_CATEGORIES } from '@/lib/landing-data';
import Image from 'next/image';
import AnimatedSection from './AnimatedSection';

export default function FeatureGrid() {
  const [activeCategory, setActiveCategory] = useState(0);
  const category = FEATURE_CATEGORIES[activeCategory];

  return (
    <section id="features" className="scroll-mt-20 bg-[#F7F9FC] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <AnimatedSection className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0D6EFD]">Fitur Lengkap</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Platform logistik terintegrasi
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-500">
            Dari pickup hingga delivery, semua terkontrol dalam satu platform yang scalable.
          </p>
        </AnimatedSection>

        <AnimatedSection delay={0.1} className="mt-10 flex flex-wrap justify-center gap-2">
          {FEATURE_CATEGORIES.map((cat, index) => (
            <button
              key={cat.code}
              type="button"
              onClick={() => setActiveCategory(index)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                activeCategory === index
                  ? 'bg-[#061B41] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </AnimatedSection>

        <motion.div
          key={category.code}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {category.features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              whileHover={{ y: -4 }}
              className="group overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:border-[#E8F0FE] hover:shadow-md"
            >
              {'image' in feature && feature.image && (
                <div className="relative mb-4 -mx-6 -mt-6 h-36 overflow-hidden border-b border-gray-100">
                  <Image
                    src={feature.image}
                    alt={feature.title}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
              )}
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8F0FE] text-xl transition group-hover:scale-110">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
