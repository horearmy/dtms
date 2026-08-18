import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guard();
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
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'CUSTOMER_SERVICE');
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
    data.status = status;
    if (status === 'CONFIRMED') data.confirmedAt = new Date();
    if (status === 'CANCELLED') {
      data.cancelledAt = new Date();
      data.cancelReason = cancelReason ? String(cancelReason).slice(0, 500) : null;
    }
  }

  const order = await prisma.order.update({ where: { id }, data });
  return NextResponse.json(order);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL');
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
  return NextResponse.json({ ok: true });
}
