import { NextRequest, NextResponse } from 'next/server';
import { guard, guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

// GET — list invoices for current tenant (any authenticated user)
export async function GET(req: NextRequest) {
  const { session, error } = await guard();
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const url = req.nextUrl.searchParams;
    const status = url.get('status') || '';
    const page = Math.max(1, parseInt(url.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.get('limit') || '20', 10)));

    const where: Record<string, unknown> = session?.tenantId ? { tenantId: session.tenantId } : {};
    if (status) where.status = status;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { payments: true },
      }),
      prisma.invoice.count({ where }),
    ]);

    return NextResponse.json({ invoices, total, page, limit, totalPages: Math.ceil(total / limit) });
  });
}

// PATCH — mark invoice as paid (admin simulation)
export async function PATCH(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.BILLING.MANAGE);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    const { invoiceId, status } = body;

    if (!invoiceId) {
      return NextResponse.json({ error: 'invoiceId wajib' }, { status: 400 });
    }

    const validStatuses = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) {
      updateData.status = status;
      if (status === 'PAID') updateData.paidAt = new Date();
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
    });

    return NextResponse.json(updated);
  });
}
