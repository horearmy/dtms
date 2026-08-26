'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

type Props = {
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  onDismiss: () => void;
};

const CONFIG: Record<NotificationType, { icon: typeof CheckCircle2; bg: string; border: string; accent: string; iconBg: string; label: string }> = {
  success: {
    icon: CheckCircle2,
    bg: 'bg-white',
    border: 'border-[#16B364]/30',
    accent: 'text-[#16B364]',
    iconBg: 'bg-[#16B364]/10',
    label: 'Berhasil',
  },
  error: {
    icon: XCircle,
    bg: 'bg-white',
    border: 'border-[#F5222D]/30',
    accent: 'text-[#F5222D]',
    iconBg: 'bg-[#F5222D]/10',
    label: 'Gagal',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-white',
    border: 'border-[#FF8A00]/30',
    accent: 'text-[#FF8A00]',
    iconBg: 'bg-[#FF8A00]/10',
    label: 'Peringatan',
  },
  info: {
    icon: Info,
    bg: 'bg-white',
    border: 'border-[#0D6EFD]/30',
    accent: 'text-[#0D6EFD]',
    iconBg: 'bg-[#0D6EFD]/10',
    label: 'Informasi',
  },
};

export default function PopupNotification({ type, title, message, duration = 4000, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const [removing, setRemoving] = useState(false);
  const cfg = CONFIG[type];
  const Icon = cfg.icon;

  useEffect(() => {
    const enter = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(enter);
  }, []);

  useEffect(() => {
    if (!visible || duration <= 0) return;
    const t = setTimeout(() => {
      setRemoving(true);
      setTimeout(onDismiss, 300);
    }, duration);
    return () => clearTimeout(t);
  }, [visible, duration, onDismiss]);

  const handleClose = () => {
    setRemoving(true);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border ${cfg.border} ${cfg.bg} px-4 py-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-sm transition-all duration-300 ${
        visible && !removing ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 -translate-y-2'
      }`}
    >
      {/* Icon */}
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cfg.iconBg}`}>
        <Icon size={20} className={cfg.accent} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="h-4 w-4 rounded object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">{cfg.label}</span>
        </div>
        <p className="mt-0.5 text-sm font-semibold text-[#101828] leading-snug">{title}</p>
        {message && <p className="mt-0.5 text-xs text-[#667085] leading-relaxed">{message}</p>}
      </div>

      {/* Close */}
      <button
        onClick={handleClose}
        className="mt-0.5 shrink-0 rounded-md p-1 text-[#98A2B3] transition-colors hover:bg-[#F2F4F7] hover:text-[#667085]"
      >
        <X size={14} />
      </button>
    </div>
  );
}
