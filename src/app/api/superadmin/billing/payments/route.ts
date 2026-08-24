import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { recordPayment } from '@/lib/billing-engine';

const METHODS = ['BANK_TRANSFER', 'VIRTUAL_ACCOUNT', 'CREDIT_CARD', 'DEBIT_CARD', 'E_WALLET', 'PAYMENT_GATEWAY', 'CASH', 'OTHER'];

// GET â€” pembayaran terbaru lintas tenant
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }
  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 25,
    include: {
      invoice: { select: { invoiceNumber: true, status: true, total: true, currency: true } },
      tenant: { select: { name: true, code: true } },
    },
  });
  return NextResponse.json({ payments });
}

// POST â€” catat pembayaran terhadap invoice (mendukung partial)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const invoiceId = String(body.invoiceId || '');
  const amount = Number(body.amount);
  const method = String(body.method || 'BANK_TRANSFER').toUpperCase();
  const reference = body.reference ? String(body.reference).trim() : undefined;

  if (!invoiceId) return NextResponse.json({ error: 'invoiceId wajib diisi' }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Nominal tidak valid' }, { status: 400 });
  if (!METHODS.includes(method)) return NextResponse.json({ error: 'Metode pembayaran tidak valid' }, { status: 400 });

  try {
    const result = await recordPayment({
      invoiceId,
      amount,
      method,
      reference,
      actor: session.id as string,
    });
    return NextResponse.json({
      payment: result.payment,
      invoice: result.invoice,
      message:
        result.invoice.status === 'PAID'
          ? 'Invoice lunas'
          : `Pembayaran parsial tercatat. Sisa outstanding Rp ${Math.round(result.invoice.total - result.invoice.discountAmount - result.invoice.paidAmount).toLocaleString('id-ID')}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Gagal mencatat pembayaran' },
      { status: 400 }
    );
  }
}
