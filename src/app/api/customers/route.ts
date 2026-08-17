import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';

const MANAGE = ['SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'CUSTOMER_SERVICE'];

export async function GET(req: NextRequest) {
  const { error } = await guard(...MANAGE);
  if (error) return error;
  const q = req.nextUrl.searchParams.get('q') || '';
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('pageSize') || '20', 10)));
  const where = q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { city: { contains: q } }] } : undefined;
  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { sentBy: true, receivedBy: true } } },
    }),
  ]);
  return NextResponse.json({ items: customers, total, page, pageSize });
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
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
      latitude: toNum(body.latitude),
      longitude: toNum(body.longitude),
    },
  });
  await logAudit(session, 'CREATE_CUSTOMER', 'CUSTOMER', { newData: customer }, req);
  return NextResponse.json(customer, { status: 201 });
}