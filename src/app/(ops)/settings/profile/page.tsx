"use client";

import { useState, useEffect, useRef } from 'react';

type TenantProfile = {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  domain: string | null;
  timezone: string;
  locale: string;
  currency: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

export default function TenantProfilePage() {
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [wlLoaded, setWlLoaded] = useState(false);
  const [uploadingBrand, setUploadingBrand] = useState<'logo' | 'favicon' | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: '', contactName: '', contactEmail: '', contactPhone: '',
    logoUrl: '', faviconUrl: '', appName: '',
    primaryColor: '#2563eb', secondaryColor: '#1e40af', accentColor: '#3b82f6',
    timezone: 'Asia/Jakarta', locale: 'id-ID', currency: 'IDR', domain: '',
  });

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const sessionRes = await fetch('/api/auth/me');
      if (!sessionRes.ok) { setError('Sesi tidak valid'); setLoading(false); return; }
      const me = await sessionRes.json();
      const tenantId = me.user?.tenantId;
      if (!tenantId) { setError('Akun tidak terkait tenant'); setLoading(false); return; }
      const res = await fetch(`/api/tenants/${tenantId}`);
      if (res.ok) {
        const t = await res.json();
        setProfile(t);
        setForm({
          name: t.name || '', contactName: t.contactName || '', contactEmail: t.contactEmail || '', contactPhone: t.contactPhone || '',
          logoUrl: t.logoUrl || '', faviconUrl: t.faviconUrl || '', appName: '',
          primaryColor: t.primaryColor || '#2563eb', secondaryColor: t.secondaryColor || '#1e40af', accentColor: t.accentColor || '#3b82f6',
          timezone: t.timezone || 'Asia/Jakarta', locale: t.locale || 'id-ID', currency: t.currency || 'IDR', domain: t.domain || '',
        });
        try {
          const wlRes = await fetch(`/api/tenants/${tenantId}/white-label`);
          if (wlRes.ok) { const wl = await wlRes.json(); setForm(f => ({ ...f, appName: wl.appName || '' })); setWlLoaded(true); }
        } catch {}
      }
    } catch { setError('Gagal memuat profil'); }
    setLoading(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/tenants/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, contactName: form.contactName || null, contactEmail: form.contactEmail || null,
          contactPhone: form.contactPhone || null, logoUrl: form.logoUrl || null, faviconUrl: form.faviconUrl || null,
          primaryColor: form.primaryColor, secondaryColor: form.secondaryColor, accentColor: form.accentColor,
          timezone: form.timezone, locale: form.locale, currency: form.currency, domain: form.domain || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Gagal menyimpan'); setSaving(false); return; }
      if (wlLoaded) {
        try {
          await fetch(`/api/tenants/${profile.id}/white-label`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appName: form.appName || null }),
          });
        } catch {}
      }
      setSuccess('Profil berhasil disimpan');
      loadProfile();
    } catch { setError('Terjadi kesalahan'); }
    setSaving(false);
  }

  async function uploadBrandAsset(file: File | undefined, field: 'logoUrl' | 'faviconUrl') {
    if (!file) return;
    const isFavicon = field === 'faviconUrl';
    const allowed = isFavicon
      ? ['image/png', 'image/webp', 'image/x-icon']
      : ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError(isFavicon ? 'Favicon harus PNG, WebP, atau ICO' : 'Logo harus JPG, PNG, atau WebP');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Ukuran logo maksimal 2MB');
      return;
    }

    setUploadingBrand(isFavicon ? 'favicon' : 'logo');
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'branding');
      const csrf = document.cookie.match(/(?:^|;\s*)dtms_csrf=([^;]*)/)?.[1] || '';
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: csrf ? { 'x-csrf-token': csrf } : undefined,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || 'Upload gagal');
        return;
      }
      setForm((current) => ({ ...current, [field]: data.url }));
      setSuccess(`${isFavicon ? 'Favicon' : 'Logo'} berhasil diunggah. Klik Simpan Perubahan.`);
    } catch {
      setError('Upload gagal, coba lagi');
    } finally {
      setUploadingBrand(null);
      if (isFavicon && faviconInputRef.current) faviconInputRef.current.value = '';
      if (!isFavicon && logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  if (loading) return <div className="py-12 text-center text-sm text-[#667085]">Memuat profil...</div>;
  if (error && !profile) return <div className="py-12 text-center text-sm text-red-600">{error}</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#101828]">Profil Perusahaan</h1>
        <p className="mt-1 text-sm text-[#667085]">Kelola informasi perusahaan, branding, dan kontak Anda.</p>
      </div>

      {success && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="ml-3 text-emerald-500 hover:text-emerald-700">&times;</button>
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <form onSubmit={save} className="space-y-6">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="mb-4 text-sm font-semibold text-[#101828]">Informasi Perusahaan</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#667085]">Nama Perusahaan *</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#667085]">Nama Header Aplikasi</label>
              <input type="text" value={form.appName} onChange={(e) => setForm({ ...form, appName: e.target.value })}
                placeholder="DTMS" className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#667085]">Domain</label>
              <input type="text" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}
                placeholder="logistik.example.com" className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#667085]">Slug</label>
              <input type="text" value={profile?.slug || ''} disabled
                className="w-full rounded-lg border border-[#E4E7EC] bg-[#F7F9FC] px-3 py-2 text-sm text-[#667085]" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#E4E7EC] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="mb-4 text-sm font-semibold text-[#101828]">Kontak</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#667085]">Nama Kontak</label>
              <input type="text" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                placeholder="John Doe" className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#667085]">Email</label>
              <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                placeholder="admin@example.com" className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#667085]">Telepon</label>
              <input type="text" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                placeholder="08123456789" className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#E4E7EC] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="mb-4 text-sm font-semibold text-[#101828]">Branding</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#667085]">Logo Perusahaan</label>
              <div className="flex min-h-28 items-center gap-4 rounded-xl border border-dashed border-[#D0D5DD] bg-[#F9FAFB] p-3">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-white p-2 shadow-sm">
                  {form.logoUrl ? <img src={form.logoUrl} alt="Preview logo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-[#98A2B3]">Logo</span>}
                </div>
                <div>
                  <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadingBrand === 'logo'}
                    className="rounded-lg bg-[#0D6EFD] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0B5FD5] disabled:opacity-60">
                    {uploadingBrand === 'logo' ? 'Mengunggah...' : 'Pilih Logo'}
                  </button>
                  {form.logoUrl && <button type="button" onClick={() => setForm({ ...form, logoUrl: '' })} className="ml-2 text-xs font-semibold text-red-600 hover:underline">Hapus</button>}
                  <p className="mt-2 text-xs text-[#98A2B3]">JPG, PNG, WebP · maksimal 2MB</p>
                </div>
              </div>
              <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => uploadBrandAsset(e.target.files?.[0], 'logoUrl')} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#667085]">Favicon Perusahaan</label>
              <div className="flex min-h-28 items-center gap-4 rounded-xl border border-dashed border-[#D0D5DD] bg-[#F9FAFB] p-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white p-2 shadow-sm">
                  {form.faviconUrl ? <img src={form.faviconUrl} alt="Preview favicon" className="h-full w-full object-contain" /> : <span className="text-[10px] text-[#98A2B3]">Icon</span>}
                </div>
                <div>
                  <button type="button" onClick={() => faviconInputRef.current?.click()} disabled={uploadingBrand === 'favicon'}
                    className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-semibold text-[#344054] hover:bg-[#F2F4F7] disabled:opacity-60">
                    {uploadingBrand === 'favicon' ? 'Mengunggah...' : 'Pilih Favicon'}
                  </button>
                  {form.faviconUrl && <button type="button" onClick={() => setForm({ ...form, faviconUrl: '' })} className="ml-2 text-xs font-semibold text-red-600 hover:underline">Hapus</button>}
                  <p className="mt-2 text-xs text-[#98A2B3]">PNG, WebP, ICO · maksimal 2MB</p>
                </div>
              </div>
              <input ref={faviconInputRef} type="file" accept="image/png,image/webp,image/x-icon,.ico" className="hidden" onChange={(e) => uploadBrandAsset(e.target.files?.[0], 'faviconUrl')} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#667085]">Warna Primer</label>
              <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                className="h-10 w-full cursor-pointer rounded-lg border border-[#E4E7EC]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#667085]">Warna Sekunder</label>
              <input type="color" value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                className="h-10 w-full cursor-pointer rounded-lg border border-[#E4E7EC]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#667085]">Warna Aksen</label>
              <input type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                className="h-10 w-full cursor-pointer rounded-lg border border-[#E4E7EC]" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-[#667085]">Preview:</span>
            <span className="h-6 w-6 rounded-lg border border-[#E4E7EC]" style={{ backgroundColor: form.primaryColor }} title="Primer" />
            <span className="h-6 w-6 rounded-lg border border-[#E4E7EC]" style={{ backgroundColor: form.secondaryColor }} title="Sekunder" />
            <span className="h-6 w-6 rounded-lg border border-[#E4E7EC]" style={{ backgroundColor: form.accentColor }} title="Aksen" />
          </div>
        </div>

        <div className="rounded-xl border border-[#E4E7EC] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="mb-4 text-sm font-semibold text-[#101828]">Regional</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#667085]">Timezone</label>
              <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none">
                <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
                <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
                <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#667085]">Bahasa</label>
              <select value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })}
                className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none">
                <option value="id-ID">Indonesia (id-ID)</option>
                <option value="en-US">English (en-US)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#667085]">Mata Uang</label>
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none">
                <option value="IDR">IDR</option>
                <option value="USD">USD</option>
                <option value="SGD">SGD</option>
                <option value="MYR">MYR</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={loadProfile}
            className="rounded-lg border border-[#E4E7EC] px-4 py-2 text-sm font-medium text-[#667085] hover:bg-[#F7F9FC]">
            Muat Ulang
          </button>
          <button type="submit" disabled={saving}
            className="rounded-lg bg-[#0D6EFD] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B5FD5] disabled:opacity-60">
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  );
}
