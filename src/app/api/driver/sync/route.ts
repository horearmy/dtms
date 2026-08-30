// src/app/api/driver/sync/route.ts
// Endpoint sinkronisasi offline driver. Dinonaktifkan karena berisiko:
//   - memajukan status ke DELIVERED tanpa POD,
//   - mengambil driverId dari body tanpa mengikat ke sesi,
//   - menulis ProofOfDelivery lintas-tenant tanpa validasi,
//   - peta DRIVER_FLOW terbalik memungkinkan regresi status.
// Gunakan /api/shipments/{id}/events (guard driver) dan /api/shipments/{id}/pod
// sebagai satu-satunya jalur perubahan status/pengiriman.
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Endpoint sinkronisasi driver ini sudah dinonaktifkan. Gunakan /api/shipments/{id}/events dan /api/shipments/{id}/pod untuk status/POD.',
    },
    { status: 410 }
  );
}
