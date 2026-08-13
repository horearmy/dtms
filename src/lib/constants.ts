export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_OPERASIONAL: 'Admin Operasional',
  DISPATCHER: 'Dispatcher',
  WAREHOUSE: 'Warehouse',
  DRIVER: 'Driver/Kurir',
  CUSTOMER_SERVICE: 'Customer Service',
  SUPERVISOR: 'Supervisor',
  MANAGEMENT: 'Management',
  CUSTOMER: 'Customer',
};

export const STATUS_LABELS: Record<string, string> = {
  ORDER_CREATED: 'Order Dibuat',
  PICKUP_SCHEDULED: 'Penjemputan Dijadwalkan',
  PICKED_UP: 'Barang Diambil',
  WAREHOUSE_RECEIVED: 'Diterima Gudang',
  SORTING: 'Sortir',
  DISPATCHED: 'Diberangkatkan',
  IN_TRANSIT: 'Dalam Perjalanan',
  ARRIVED_AT_HUB: 'Tiba di Hub',
  OUT_FOR_DELIVERY: 'Sedang Diantar',
  DELIVERED: 'Terkirim',
  DELIVERY_FAILED: 'Gagal Dikirim',
  RESCHEDULED: 'Dijadwalkan Ulang',
  RETURN_TO_SENDER: 'Dikembalikan ke Pengirim',
  RETURNED: 'Dikembalikan',
};

export const STATUS_COLORS: Record<string, string> = {
  ORDER_CREATED: 'bg-slate-100 text-slate-700',
  PICKUP_SCHEDULED: 'bg-blue-100 text-blue-700',
  PICKED_UP: 'bg-indigo-100 text-indigo-700',
  WAREHOUSE_RECEIVED: 'bg-cyan-100 text-cyan-700',
  SORTING: 'bg-violet-100 text-violet-700',
  DISPATCHED: 'bg-fuchsia-100 text-fuchsia-700',
  IN_TRANSIT: 'bg-amber-100 text-amber-700',
  ARRIVED_AT_HUB: 'bg-orange-100 text-orange-700',
  OUT_FOR_DELIVERY: 'bg-yellow-100 text-yellow-800',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  DELIVERY_FAILED: 'bg-red-100 text-red-700',
  RESCHEDULED: 'bg-rose-100 text-rose-700',
  RETURN_TO_SENDER: 'bg-pink-100 text-pink-700',
  RETURNED: 'bg-slate-200 text-slate-700',
};

export const ACTIVE_STATUSES = [
  'ORDER_CREATED',
  'PICKUP_SCHEDULED',
  'PICKED_UP',
  'WAREHOUSE_RECEIVED',
  'SORTING',
  'DISPATCHED',
  'IN_TRANSIT',
  'ARRIVED_AT_HUB',
  'OUT_FOR_DELIVERY',
  'RESCHEDULED',
];

export const SERVICE_TYPES = [
  { value: 'SAME_DAY', label: 'Same Day (< 12 jam)' },
  { value: 'NEXT_DAY', label: 'Next Day (< 24 jam)' },
  { value: 'REGULAR', label: 'Regular (2–4 hari)' },
];

export const FAILURE_REASONS = [
  'Penerima tidak berada di lokasi',
  'Alamat tidak ditemukan',
  'Penerima menolak',
  'Nomor telepon tidak aktif',
  'Akses lokasi tidak memungkinkan',
  'Barang rusak',
  'Kondisi lainnya',
];

export const NEXT_STATUS: Record<string, string> = {
  ORDER_CREATED: 'PICKUP_SCHEDULED',
  PICKUP_SCHEDULED: 'PICKED_UP',
  PICKED_UP: 'WAREHOUSE_RECEIVED',
  WAREHOUSE_RECEIVED: 'SORTING',
  SORTING: 'DISPATCHED',
  DISPATCHED: 'IN_TRANSIT',
  IN_TRANSIT: 'ARRIVED_AT_HUB',
  ARRIVED_AT_HUB: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
  RESCHEDULED: 'OUT_FOR_DELIVERY',
  RETURN_TO_SENDER: 'RETURNED',
};

export function generateTrackingNumber() {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(100000 + Math.floor(Math.random() * 899999));
  return `DTMS-${ymd}-${seq}`;
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return '-';
  const d = new Date(value);
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return '-';
  const d = new Date(value);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatNumber(n: number | null | undefined) {
  if (n == null) return '0';
  return n.toLocaleString('id-ID');
}

export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'jakarta': { lat: -6.2088, lng: 106.8456 },
  'jakarta pusat': { lat: -6.1865, lng: 106.8346 },
  'jakarta selatan': { lat: -6.2615, lng: 106.8104 },
  'jakarta barat': { lat: -6.1683, lng: 106.7587 },
  'jakarta timur': { lat: -6.225, lng: 106.9004 },
  'jakarta utara': { lat: -6.1324, lng: 106.8806 },
  'bandung': { lat: -6.9175, lng: 107.6191 },
  'surabaya': { lat: -7.2575, lng: 112.7521 },
  'bekasi': { lat: -6.2383, lng: 106.9756 },
  'bogor': { lat: -6.5971, lng: 106.806 },
  'tangerang': { lat: -6.1783, lng: 106.6319 },
  'tangerang selatan': { lat: -6.2886, lng: 106.7179 },
  'depok': { lat: -6.4025, lng: 106.7942 },
  'semarang': { lat: -6.9667, lng: 110.4167 },
  'yogyakarta': { lat: -7.7971, lng: 110.3688 },
  'medan': { lat: 3.5952, lng: 98.6722 },
  'makassar': { lat: -5.1477, lng: 119.4327 },
};

export function coordForCity(city?: string | null): { lat: number; lng: number } | null {
  if (!city) return null;
  const key = city.toLowerCase().trim();
  return CITY_COORDS[key] || null;
}

export const SLA_HOURS: Record<string, number> = {
  SAME_DAY: 12,
  NEXT_DAY: 24,
  REGULAR: 96,
};

export function formatKm(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}