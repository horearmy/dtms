'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FAQS } from '@/lib/landing-data';
import { ChevronDown } from 'lucide-react';
import AnimatedSection from './AnimatedSection';

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-20 bg-[#F7F9FC] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <AnimatedSection className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0D6EFD]">FAQ</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Pertanyaan yang Sering Diajukan
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-500">
            Temukan jawaban atas pertanyaan umum seputar DTMS.
          </p>
        </AnimatedSection>

        <AnimatedSection delay={0.1} className="mt-12 space-y-3">
          {FAQS.map((faq, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-blue-200"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-sm font-semibold text-gray-900 sm:text-base">{faq.question}</span>
                <motion.span
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="ml-4 shrink-0 text-gray-400"
                >
                  <ChevronDown size={20} />
                </motion.span>
              </button>
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="border-t border-gray-100 px-5 pb-5 pt-3">
                      <p className="text-sm leading-6 text-gray-500">{faq.answer}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </AnimatedSection>
      </div>
    </section>
  );
}
