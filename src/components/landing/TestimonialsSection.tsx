'use client';

import { motion } from 'framer-motion';
import { TESTIMONIALS } from '@/lib/landing-data';
import { Star, User } from 'lucide-react';
import AnimatedSection from './AnimatedSection';

export default function TestimonialsSection() {
  return (
    <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <AnimatedSection className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0D6EFD]">Testimoni</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Dipercaya oleh tim operasional
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-500">
            Lihat bagaimana DTMS membantu bisnis logistik meningkatkan visibilitas dan efisiensi.
          </p>
        </AnimatedSection>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -4 }}
              className="flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    className={i < testimonial.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}
                  />
                ))}
              </div>
              <p className="mt-4 flex-1 text-sm leading-7 text-gray-600">"{testimonial.quote}"</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E8F0FE] text-[#0D6EFD]">
                  <User size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{testimonial.name}</p>
                  <p className="text-xs text-gray-500">
                    {testimonial.role}, {testimonial.company}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
