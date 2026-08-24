import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET — daftar invoice lintas tenant (superadmin only)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20', 10)));
  const status = sp.get('status') || '';
  const q = (sp.get('q') || '').trim();
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (status && status !== 'ALL') where.status = status;
  if (q) {
    where.OR = [
      { invoiceNumber: { contains: q, mode: 'insensitive' } },
      { tenant: { is: { name: { contains: q, mode: 'insensitive' } } } },
      { tenant: { is: { code: { contains: q, mode: 'insensitive' } } } },
    ];
  }

  const [rows, total, agg] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true, invoiceNumber: true, status: true, subtotal: true, discountAmount: true,
        tax: true, total: true, paidAmount: true, currency: true, dueDate: true,
        issuedAt: true, paidAt: true, periodKey: true, createdAt: true,
        tenant: { select: { id: true, name: true, code: true, plan: true } },
      },
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.aggregate({
      where,
      _sum: { total: true, paidAmount: true },
    }),
  ]);

  return NextResponse.json({
    invoices: rows.map((r) => ({
      ...r,
      outstanding: Math.max(0, Math.round(r.total - r.discountAmount - r.paidAmount)),
    })),
    total,
    page,
    pageSize,
    sumTotal: Math.round(agg._sum.total ?? 0),
    sumPaid: Math.round(agg._sum.paidAmount ?? 0),
  });
}
