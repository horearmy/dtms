import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET â€” daftar kontrak + pencarian tenant/nomor kontrak
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20', 10)));
  const q = (sp.get('q') || '').trim();

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { contractNumber: { contains: q, mode: 'insensitive' } },
      { tenant: { is: { name: { contains: q, mode: 'insensitive' } } } },
      { tenant: { is: { code: { contains: q, mode: 'insensitive' } } } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { tenant: { select: { name: true, code: true, plan: true } } },
    }),
    prisma.contract.count({ where }),
  ]);
  return NextResponse.json({ contracts: rows, total, page, pageSize });
}

// POST â€” buat kontrak baru untuk tenant
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const tenantId = String(body.tenantId || '');
  const planCode = String(body.planCode || '').toUpperCase() || null;
  const billingCycle = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'].includes(String(body.billingCycle))
    ? String(body.billingCycle)
    : 'MONTHLY';
  const paymentTermsDays = Math.min(90, Math.max(0, parseInt(String(body.paymentTermsDays ?? 14), 10) || 14));
  const gracePeriodDays = Math.min(60, Math.max(0, parseInt(String(body.gracePeriodDays ?? 14), 10) || 14));
  const creditLimit = Number(body.creditLimit) >= 0 ? Number(body.creditLimit) : 0;
  const autoRenew = Boolean(body.autoRenew);
  const startDate = body.startDate ? new Date(String(body.startDate)) : new Date();
  const endDate = body.endDate ? new Date(String(body.endDate)) : null;

  if (!tenantId) return NextResponse.json({ error: 'tenantId wajib diisi' }, { status: 400 });

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { code: true, slug: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 });

    let contractNumber = String(body.contractNumber || '').trim();
    if (!contractNumber) {
      // Format: CTR/{TENANT_CODE}/{YYYY}/{seq}
      const year = new Date().getFullYear();
      const count = await prisma.contract.count();
      contractNumber = `CTR/${tenant.code || tenant.slug.slice(0, 8).toUpperCase()}/${year}/${String(count + 1).padStart(5, '0')}`;
    }
    const dup = await prisma.contract.findUnique({ where: { contractNumber }, select: { id: true } });
    if (dup) return NextResponse.json({ error: 'Nomor kontrak sudah dipakai' }, { status: 400 });

    const contract = await prisma.contract.create({
      data: {
        tenantId,
        contractNumber,
        planCode,
        startDate,
        endDate,
        billingCycle,
        paymentTermsDays,
        autoRenew,
        creditLimit,
        gracePeriodDays,
        status: 'ACTIVE',
      },
    });
    await prisma.auditLog.create({
      data: {
        action: 'CREATE_CONTRACT',
        module: 'BILLING',
        tenantId,
        newData: JSON.stringify({ contractNumber, planCode, billingCycle }),
        userId: session.id,
      },
    });
    return NextResponse.json({ contract });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Gagal membuat kontrak' },
      { status: 400 }
    );
  }
}
