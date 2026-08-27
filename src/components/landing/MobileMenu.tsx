'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Menu } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Platform', href: '#platform' },
  { label: 'Live Tracking', href: '#live-tracking' },
  { label: 'Fitur', href: '#features' },
  { label: 'Harga', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Demo', href: '#demo' },
];

export default function MobileMenu({ onLogin }: { onLogin: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Menu"
        onClick={() => setOpen(true)}
        className="md:hidden rounded-lg p-2 text-white hover:bg-white/10"
      >
        <Menu size={24} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 z-50 h-full w-72 bg-[#061B41] p-6 shadow-2xl md:hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-white">Menu</span>
                <button
                  type="button"
                  aria-label="Tutup menu"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-white hover:bg-white/10"
                >
                  <X size={24} />
                </button>
              </div>
              <nav className="mt-8 flex flex-col gap-4">
                {NAV_ITEMS.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="text-base font-medium text-blue-100/80 transition hover:text-white"
                  >
                    {item.label}
                  </a>
                ))}
                <hr className="my-2 border-white/10" />
                <button
                  onClick={() => {
                    setOpen(false);
                    onLogin();
                  }}
                  className="rounded-lg bg-white py-3 text-center text-sm font-bold text-[#061B41] transition hover:bg-blue-50"
                >
                  Masuk
                </button>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
