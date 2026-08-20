import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.CUSTOMER.READ);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
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
      }),
    ]);

    const customerIds = customers.map((c) => c.id);
    const sentByMap = new Map<string, number>();
    const receivedByMap = new Map<string, number>();

    if (customerIds.length > 0) {
      const [sentRows, recvRows] = await Promise.all([
        prisma.$queryRaw<{ senderId: string; cnt: bigint }[]>`
          SELECT "senderId", COUNT(*) AS cnt FROM "Shipment"
          WHERE "senderId" = ANY(${customerIds}) GROUP BY "senderId"
        `,
        prisma.$queryRaw<{ receiverId: string; cnt: bigint }[]>`
          SELECT "receiverId", COUNT(*) AS cnt FROM "Shipment"
          WHERE "receiverId" = ANY(${customerIds}) GROUP BY "receiverId"
        `,
      ]);
      for (const row of sentRows) sentByMap.set(row.senderId, Number(row.cnt));
      for (const row of recvRows) receivedByMap.set(row.receiverId, Number(row.cnt));
    }

    const items = customers.map((c) => ({
      ...c,
      _count: {
        sentBy: sentByMap.get(c.id) || 0,
        receivedBy: receivedByMap.get(c.id) || 0,
      },
    }));

    return NextResponse.json({ items, total, page, pageSize });
  });
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.CUSTOMER.CREATE);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
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
  });
}
