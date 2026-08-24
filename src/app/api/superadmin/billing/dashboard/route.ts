import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getBillingDashboard } from '@/lib/billing-engine';

// GET — KPI dashboard billing enterprise (superadmin only)
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }
  const data = await getBillingDashboard();
  return NextResponse.json(data);
}
