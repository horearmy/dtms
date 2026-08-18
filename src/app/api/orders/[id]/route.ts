import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

const VALID_ORDER_STATUSES = ['DRAFT', 'RECEIVED', 'VALIDATING', 'VALIDATED', 'REJECTED', 'CONFIRMED', 'CANCELLED', 'FULFILLED'] as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, scope, error } = await guardPermission(PERMISSIONS.ORDER.READ);
  if (error) return error;

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      shipment: {
        select: { id: true, trackingNumber: true, status: true, origin: true, destination: true },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
  }

  return NextResponse.json(order);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, scope, error } = await guardPermission(PERMISSIONS.ORDER.UPDATE);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { status, cancelReason } = body;

  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (status) {
    const trimmedStatus = String(status).trim();
    if (!(VALID_ORDER_STATUSES as readonly string[]).includes(trimmedStatus)) {
      return NextResponse.json({ error: `Status tidak valid. Nilai yang diizinkan: ${VALID_ORDER_STATUSES.join(', ')}` }, { status: 400 });
    }
    data.status = trimmedStatus;
    if (trimmedStatus === 'CONFIRMED') data.confirmedAt = new Date();
    if (trimmedStatus === 'CANCELLED') {
      data.cancelledAt = new Date();
      data.cancelReason = cancelReason ? String(cancelReason).trim().slice(0, 500) : null;
    }
  }

  const order = await prisma.order.update({ where: { id }, data });

  await logAudit(session, 'UPDATE_ORDER', 'ORDER', { newData: { status } }, req);

  return NextResponse.json(order);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, scope, error } = await guardPermission(PERMISSIONS.ORDER.CANCEL);
  if (error) return error;

  const { id } = await params;
  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
  }

  if (existing.status === 'CONFIRMED' || existing.status === 'FULFILLED') {
    return NextResponse.json({ error: 'Tidak dapat menghapus order yang sudah diproses' }, { status: 400 });
  }

  await prisma.orderItem.deleteMany({ where: { orderId: id } });
  await prisma.order.delete({ where: { id } });

  await logAudit(session, 'DELETE_ORDER', 'ORDER', { newData: { id } }, req);

  return NextResponse.json({ ok: true });
}
