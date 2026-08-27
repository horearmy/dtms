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
      const csrf = document.cookie.match(/(?:^|;\s*)dtms_csrf=([^;]*)/)?.[1] || '';
      const data = await new Promise<{ url?: string; error?: string; status: number }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload');
        if (csrf) xhr.setRequestHeader('x-csrf-token', csrf);
        xhr.onload = () => {
          let json: any = {};
          try { json = JSON.parse(xhr.responseText); } catch {}
          resolve({ ...json, status: xhr.status });
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(fd);
      });
      if (data.status < 200 || data.status >= 300) return alert(data.error || `Upload gagal (${data.status})`);
      if (!data.url) return alert('Upload gagal: URL tidak dikembalikan server');
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
      <label className="mb-1 block text-xs font-semibold text-[#667085]">{label}</label>
      <div
        onClick={() => inputRef.current?.click()}
        className="group relative flex h-24 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#E4E7EC] bg-[#F7F9FC] hover:border-[#0D6EFD]"
      >
        {preview || value ? (
          <img src={preview || value!} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="text-center text-[11px] text-[#667085]">
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
            className="absolute right-1 top-1 rounded-full bg-[#F5222D] px-1.5 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100"
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
