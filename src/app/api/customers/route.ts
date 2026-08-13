import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';

const MANAGE = ['SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'CUSTOMER_SERVICE'];

export async function GET(req: NextRequest) {
  const { error } = await guard(...MANAGE);
  if (error) return error;
  const q = req.nextUrl.searchParams.get('q') || '';
  const customers = await prisma.customer.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { city: { contains: q } }] } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { sentBy: true, receivedBy: true } } },
  });
  return NextResponse.json(customers);
}

export async function POST(req: NextRequest) {
  const { session, error } = await guard(...MANAGE);
  if (error) return error;
  const body = await req.json();
  if (!body.name || !body.phone) {
    return NextResponse.json({ error: 'Nama dan telepon wajib diisi' }, { status: 400 });
  }
  const customer = await prisma.customer.create({
    data: {
      name: body.name,
      phone: body.phone,
      email: body.email || null,
      address: body.address || null,
      city: body.city || null,
      postalCode: body.postalCode || null,
    },
  });
  await logAudit(session, 'CREATE_CUSTOMER', 'CUSTOMER', customer.name);
  return NextResponse.json(customer, { status: 201 });
}