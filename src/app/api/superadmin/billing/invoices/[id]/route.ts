import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { issueInvoice, voidInvoice } from '@/lib/billing-engine';

type Params = { params: Promise<{ id: string }> };

// GET â€” detail invoice + riwayat payment
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      tenant: { select: { id: true, name: true, code: true, plan: true } },
      subscription: { select: { billingCycle: true, plan: { select: { name: true, code: true } } } },
      payments: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!inv) return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 });
  return NextResponse.json({
    invoice: { ...inv, outstanding: Math.max(0, Math.round(inv.total - inv.discountAmount - inv.paidAmount)) },
  });
}

// PATCH â€” aksi lifecycle: ISSUE / VOID (invoice ISSUED immutable â€” spec Â§2.3)
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '').toUpperCase();

  try {
    if (action === 'ISSUE') {
      const updated = await issueInvoice(id, session.id);
      return NextResponse.json({ invoice: updated });
    }
    if (action === 'VOID') {
      const updated = await voidInvoice(id, String(body.reason || ''), session.id);
      return NextResponse.json({ invoice: updated });
    }
    return NextResponse.json({ error: 'Aksi tidak dikenal. Gunakan ISSUE atau VOID.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal memproses invoice' }, { status: 400 });
  }
}
