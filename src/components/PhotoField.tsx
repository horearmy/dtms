"use client";

import { useRef, useState } from 'react';

export default function PhotoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFile(f: File | undefined) {
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      return alert('Format gambar harus JPG, PNG, atau WebP');
    }
    if (f.size > 5 * 1024 * 1024) return alert('Ukuran gambar maksimal 5MB');
    setPreview(URL.createObjectURL(f));
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) return alert(data.error || 'Upload gagal');
      onChange(data.url);
    } catch {
      alert('Upload gagal, coba lagi');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
      <div
        onClick={() => inputRef.current?.click()}
        className="group relative flex h-24 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 hover:border-brand-400"
      >
        {preview || value ? (
          <img src={preview || value!} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="text-center text-[11px] text-slate-400">
            {uploading ? 'Mengunggah...' : '+ Pilih Foto'}
          </span>
        )}
        {(preview || value) && !uploading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreview(null);
              onChange(null);
            }}
            className="absolute right-1 top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100"
          >
            ✕
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
