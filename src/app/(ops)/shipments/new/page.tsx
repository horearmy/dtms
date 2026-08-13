"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, inputCls, btnPrimary, btnGhost } from '@/components/ui';
import RoutePreviewMap, { type RoutePoint } from '@/components/RoutePreviewMap';
import { SERVICE_TYPES } from '@/lib/constants';

type Customer = { id: string; name: string; phone: string; city: string | null; address: string | null; latitude: number | null; longitude: number | null };

export default function NewShipmentPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({
    senderId: '', itemName: '', itemCount: '1',
    weight: '', volume: '', serviceType: 'REGULAR', fragile: false,
    itemCategory: '', itemValue: '', deliveryTarget: '',
  });
  const [destinations, setDestinations] = useState<string[]>(['']);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/customers').then((r) => r.ok && r.json()).then(setCustomers).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    if (!form.senderId) {
      setMsg('Pilih pengirim (jika belum ada, tambahkan di menu Customers)');
      return;
    }
    const validDests = destinations.map((d) => d.trim()).filter(Boolean);
    if (validDests.length === 0) {
      setMsg('Tambahkan minimal satu tujuan');
      return;
    }
    if (validDests.some((d) => d === form.senderId)) {
      setMsg('Tujuan tidak boleh sama dengan pengirim');
      return;
    }
    const byId = (id: string) => customers.find((c) => c.id === id);
    const sender = byId(form.senderId);
    if (!sender) {
      setMsg('Pengirim tidak valid');
      return;
    }
    const stops = [
      { seq: 0, customerId: sender.id, label: sender.name, address: sender.address, city: sender.city, postalCode: null, lat: sender.latitude, lng: sender.longitude },
      ...validDests.map((id, i) => {
        const c = byId(id);
        return {
          seq: i + 1,
          customerId: c!.id,
          label: c!.name,
          address: c!.address,
          city: c!.city,
          postalCode: null,
          lat: c!.latitude,
          lng: c!.longitude,
        };
      }),
    ];

    setLoading(true);
    const res = await fetch('/api/shipments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        receiverId: stops[stops.length - 1].customerId,
        stops,
      }),
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

  const sender = customers.find((c) => c.id === form.senderId);
  const destCustomers = destinations.map((id) => customers.find((c) => c.id === id));

  const previewStops: Array<RoutePoint | null> = [
    sender ? { label: `${sender.name} (${sender.city || '-'})`, city: sender.city, address: sender.address, lat: sender.latitude, lng: sender.longitude } : null,
    ...destCustomers.map((c) => (c ? { label: `${c.name} (${c.city || '-'})`, city: c.city, address: c.address, lat: c.latitude, lng: c.longitude } : null)),
  ];

  function setDest(i: number, id: string) {
    setDestinations((prev) => prev.map((d, idx) => (idx === i ? id : d)));
  }
  function addDest() {
    setDestinations((prev) => [...prev, '']);
  }
  function removeDest(i: number) {
    setDestinations((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : ['']));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Buat Shipment Baru</h1>
        <p className="text-sm text-slate-500">Nomor resi dibuat otomatis · satu shipment bisa punya beberapa tujuan (multi-stop)</p>
      </div>

      <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Pengirim & Daftar Tujuan</h2>

          <Field label="Pengirim" required>
            <select required value={form.senderId} onChange={(e) => setForm({ ...form, senderId: e.target.value })} className={inputCls}>
              <option value="">-- Pilih customer --</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.city || '-'}</option>)}
            </select>
          </Field>

          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Daftar Perjalanan (Tujuan)</span>
            </div>
            {destinations.map((id, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">{i + 1}</span>
                <select value={id} onChange={(e) => setDest(i, e.target.value)} className={inputCls}>
                  <option value="">-- Pilih customer tujuan --</option>
                  {customers.filter((c) => c.id !== form.senderId).map((c) => <option key={c.id} value={c.id}>{c.name} · {c.city || '-'}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => removeDest(i)}
                  title="Hapus tujuan"
                  className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-400 hover:bg-red-50 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" onClick={addDest} className={btnGhost + ' !py-1.5 text-xs'}>+ Tambah Tujuan</button>
          </div>

          <div className="mt-4">
            <RoutePreviewMap stops={previewStops} />
          </div>

          <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-3">
              <b>Asal:</b> {sender ? `${sender.address || '-'}, ${sender.city || '-'}` : '-'}
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <b>Tujuan:</b>{' '}
              {destCustomers.filter(Boolean).map((c) => `${c?.city || c?.name || '-'}`).join(' → ') || '-'}
            </div>
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