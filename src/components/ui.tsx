'use client';

import { useEffect, useRef, useCallback } from 'react';

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2, 8)}`);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const modal = document.querySelector('[role="dialog"]');
        if (!modal) return;
        const focusable = modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    const timer = setTimeout(() => {
      const modal = document.querySelector<HTMLElement>('[role="dialog"]');
      modal?.focus();
    }, 50);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [open, handleKeyDown]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId.current}
        tabIndex={-1}
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)] max-h-[90vh] overflow-y-auto outline-none`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id={titleId.current} className="text-base font-bold text-[#101828]">{title}</h3>
          <button onClick={onClose} aria-label="Tutup" className="rounded-lg p-1 text-[#667085] hover:bg-[#F7F9FC]">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[#667085]">
        {label} {required && <span className="text-[#F5222D]">*</span>}
      </label>
      {children}
    </div>
  );
}

export const inputCls =
  'w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none';

export const btnPrimary =
  'rounded-lg bg-[#0D6EFD] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0B5FD5] disabled:opacity-60';

export const btnGhost =
  'rounded-lg border border-[#E4E7EC] bg-white px-4 py-2 text-sm font-medium text-[#101828] transition hover:bg-[#F7F9FC]';

export function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 text-center text-sm text-[#667085]">{text}</td>
    </tr>
  );
}