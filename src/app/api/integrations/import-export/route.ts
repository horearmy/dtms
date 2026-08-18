import { NextRequest, NextResponse } from 'next/server';
import { guard } from '@/lib/api-guard';
import { importCustomers, importDrivers, exportShipments, parseCsv } from '@/lib/integration-hub';

// POST — CSV import
export async function POST(req: NextRequest) {
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL');
  if (error) return error;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const type = formData.get('type') as string; // 'customer' | 'driver'

  if (!file || !type) {
    return NextResponse.json({ error: 'file dan type wajib' }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCsv(text);

  if (rows.length === 0) {
    return NextResponse.json({ error: 'CSV kosong atau format tidak valid' }, { status: 400 });
  }

  const tenantId = session?.tenantId || '';
  let result;

  switch (type) {
    case 'customer':
      result = await importCustomers(tenantId, rows);
      break;
    case 'driver':
      result = await importDrivers(tenantId, rows);
      break;
    default:
      return NextResponse.json({ error: 'type tidak valid' }, { status: 400 });
  }

  return NextResponse.json(result);
}

// GET — CSV export
export async function GET(req: NextRequest) {
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL');
  if (error) return error;

  const url = new URL(req.url);
  const entity = url.searchParams.get('entity') || 'shipment';
  const status = url.searchParams.get('status') || undefined;
  const from = url.searchParams.get('from') || undefined;
  const to = url.searchParams.get('to') || undefined;

  if (entity !== 'shipment') {
    return NextResponse.json({ error: 'Export hanya mendukung shipment' }, { status: 400 });
  }

  const csv = await exportShipments(session?.tenantId || '', { status, from, to });

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="shipments-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
