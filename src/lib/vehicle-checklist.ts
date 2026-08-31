// Katalog item ceklist kendaraan pasca perjalanan.
export type CheckItem = { key: string; label: string; hint?: string };

export const VEHICLE_CHECK_ITEMS: CheckItem[] = [
  { key: 'bodyn', label: 'Body kendaraan', hint: 'Penyok, goresan, kerusakan' },
  { key: 'mesinn', label: 'Mesin', hint: 'Bunyi abnormal, oli bocor' },
  { key: 'roda', label: 'Roda & ban', hint: 'Tekanan, permukaan, kondisi' },
  { key: 'rem', label: 'Rem', hint: 'Fungsi pengereman normal' },
  { key: 'lampu', label: 'Lampu', hint: 'Lampu utama, sein, dan rem' },
  { key: 'kaca', label: 'Kaca & spion', hint: 'Retak, bersih, fungsi spion' },
  { key: 'kabin', label: 'Kabin / interior', hint: 'Kebersihan, bangku, sabuk' },
  { key: 'kargo', label: 'Area kargo', hint: 'Kondisi pintu & ruang kargo' },
  { key: 'lainn', label: 'Lainnya', hint: 'Masalah lain yang ditemukan' },
];

export const VEHICLE_CHECK_KEYS = VEHICLE_CHECK_ITEMS.map((i) => i.key);

export function labelFor(key: string): string {
  return VEHICLE_CHECK_ITEMS.find((i) => i.key === key)?.label ?? key;
}

export type VehicleCheckResult = {
  answers: Record<string, 'ok' | 'issue'>;
  issues: string[];
  hasIssue: boolean;
};
