import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ planCode: string }> };

// GET — daftar tenant yang berlangganan plan tertentu (superadmin only)
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const { planCode: rawCode } = await params;
  const planCode = decodeURIComponent(rawCode).toUpperCase();

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('pageSize') || '20', 10)));
  const q = req.nextUrl.searchParams.get('q') || '';
  const skip = (page - 1) * pageSize;

  const plan = await prisma.plan.findUnique({ where: { code: planCode } });
  if (!plan) {
    return NextResponse.json({ error: 'Plan tidak ditemukan' }, { status: 404 });
  }

  const searchFilter = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { slug: { contains: q, mode: 'insensitive' as const } },
          { code: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {};

  // Tenant pada plan ini: punya subscription aktif dengan planId tsb,
  // atau (khusus FREE) tidak punya subscription sama sekali.
  const where: Record<string, unknown> = {
    AND: [
      searchFilter,
      {
        OR: [
          { subscription: { is: { planId: plan.id, status: 'ACTIVE' } } },
          ...(plan.code === 'FREE'
            ? [{ subscription: null }]
            : [{ subscription: { is: { planId: plan.id } } }]),
        ],
      },
    ],
  };

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        code: true,
        contactEmail: true,
        active: true,
        createdAt: true,
        subscription: {
          select: {
            status: true,
            billingCycle: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            trialEndsAt: true,
            cancelledAt: true,
          },
        },
      },
    }),
    prisma.tenant.count({ where }),
  ]);

  return NextResponse.json({
    plan: {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
    },
    tenants,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
