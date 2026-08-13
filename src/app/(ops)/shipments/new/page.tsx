"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, inputCls, btnPrimary, btnGhost } from '@/components/ui';
import RoutePreviewMap from '@/components/RoutePreviewMap';
import { SERVICE_TYPES } from '@/lib/constants';

type Customer = { id: string; name: string; phone: string; city: string | null; address: string | null };

export default function NewShipmentPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({
    senderId: '', receiverId: '', itemName: '', itemCount: '1',
    weight: '', volume: '', serviceType: 'REGULAR', fragile: false,
    itemCategory: '', itemValue: '', deliveryTarget: '',
  });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/customers').then((r) => r.ok && r.json()).then(setCustomers).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    if (!form.senderId || !form.receiverId) {
      setMsg('Pilih pengirim dan penerima (jika belum ada, tambahkan di menu Customers)');
      return;
    }
    if (form.senderId === form.receiverId) {
      setMsg('Pengirim dan penerima tidak boleh sama');
      return;
    }
    setLoading(true);
    const res = await fetch('/api/shipments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error || 'Gagal membuat shipment');
      return;
    }
    router.push(`/shipments/${data.id}`);
    router.refresh();
  }

  const origin = customers.find((c) => c.id === form.senderId);
  const dest = customers.find((c) => c.id === form.receiverId);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Buat Shipment Baru</h1>
        <p className="text-sm text-slate-500">Nomor resi akan dibuat otomatis</p>
      </div>

      <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Pengirim & Penerima</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Pengirim" required>
              <select required value={form.senderId} onChange={(e) => setForm({ ...form, senderId: e.target.value })} className={inputCls}>
                <option value="">-- Pilih customer --</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.city || '-'}</option>)}
              </select>
            </Field>
            <Field label="Penerima" required>
              <select required value={form.receiverId} onChange={(e) => setForm({ ...form, receiverId: e.target.value })} className={inputCls}>
                <option value="">-- Pilih customer --</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.city || '-'}</option>)}
              </select>
            </Field>
          </div>
          <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-3">
              <b>Asal:</b> {origin ? `${origin.address || '-'}, ${origin.city || '-'}` : '-'}
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <b>Tujuan:</b> {dest ? `${dest.address || '-'}, ${dest.city || '-'}` : '-'}
            </div>
          </div>

          <div className="mt-4">
            <RoutePreviewMap
              origin={origin ? { label: `${origin.name} (${origin.city || '-'})`, city: origin.city, address: origin.address } : null}
              dest={dest ? { label: `${dest.name} (${dest.city || '-'})`, city: dest.city, address: dest.address } : null}
            />
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Detail Barang</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Nama Barang">
              <input value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} className={inputCls} placeholder="Mis: Dokumen, Elektronik" />
            </Field>
            <Field label="Jumlah">
              <input type="number" min={1} value={form.itemCount} onChange={(e) => setForm({ ...form, itemCount: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Berat (kg)" required>
              <input required type="number" step="0.1" min="0" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Volume (m³)">
              <input type="number" step="0.01" value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Kategori">
              <input value={form.itemCategory} onChange={(e) => setForm({ ...form, itemCategory: e.target.value })} className={inputCls} placeholder="Umum / Fragile / dsb" />
            </Field>
            <Field label="Nilai Barang (Rp)">
              <input type="number" value={form.itemValue} onChange={(e) => setForm({ ...form, itemValue: e.target.value })} className={inputCls} />
            </Field>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Pengiriman</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Service Type">
              <select value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })} className={inputCls}>
                {SERVICE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Target Kirim (tanggal)">
              <input type="datetime-local" value={form.deliveryTarget} onChange={(e) => setForm({ ...form, deliveryTarget: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Fragile">
              <label className="flex items-center gap-2 pt-2 text-sm text-slate-600">
                <input type="checkbox" checked={form.fragile} onChange={(e) => setForm({ ...form, fragile: e.target.checked })} className="h-4 w-4" />
                Barang mudah pecah
              </label>
            </Field>
          </div>
        </div>

        {msg && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{msg}</div>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => router.back()} className={btnGhost}>Batal</button>
          <button type="submit" disabled={loading} className={btnPrimary}>{loading ? 'Menyimpan...' : 'Buat Shipment'}</button>
        </div>
      </form>
    </div>
  );
}