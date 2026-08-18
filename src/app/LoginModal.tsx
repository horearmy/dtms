'use client';

import { useState } from 'react';
import LoginForm from '@/app/login/LoginForm';
import { X } from 'lucide-react';

export default function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 mx-4 w-full max-w-[440px]">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-100"
        >
          <X size={16} />
        </button>
        <LoginForm />
      </div>
    </div>
  );
}
