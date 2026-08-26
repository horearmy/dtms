import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/api-guard';
import { assertStepUp } from '@/lib/superadmin-auth';

const VALID_TRANSITIONS: Record<string, string[]> = {
  PROSPECT: ['PENDING_APPROVAL', 'ARCHIVED'],
  PENDING_APPROVAL: ['ONBOARDING', 'ARCHIVED'],
  ONBOARDING: ['UAT', 'ACTIVE', 'SUSPENDED'],
  UAT: ['ACTIVE', 'SUSPENDED', 'OFFBOARDING'],
  ACTIVE: ['SUSPENDED', 'GRACE_PERIOD', 'OFFBOARDING'],
  SUSPENDED: ['ACTIVE', 'GRACE_PERIOD', 'OFFBOARDING'],
  GRACE_PERIOD: ['ACTIVE', 'SUSPENDED', 'OFFBOARDING'],
  OFFBOARDING: ['ARCHIVED', 'ACTIVE'],
  ARCHIVED: ['PROSPECT'],
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const { id } = await params;
  if (session.role !== 'SUPER_ADMIN' && session.tenantId !== id) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, status: true, active: true, createdAt: true },
  });
  if (!tenant) return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 });

  const allowedTransitions = VALID_TRANSITIONS[tenant.status] || [];

  const history = await prisma.auditLog.findMany({
    where: { tenantId: id, module: 'TENANT', action: { contains: 'STATUS' } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const onboarding = await prisma.tenantOnboarding.findMany({
    where: { tenantId: id },
    orderBy: { order: 'asc' },
  });
  const onboardingProgress = onboarding.length > 0
    ? Math.round((onboarding.filter(s => s.status === 'COMPLETED').length / 8) * 100)
    : 0;

  return NextResponse.json({
    tenant,
    allowedTransitions,
    history: history.map(h => ({ action: h.action, oldData: h.oldData, newData: h.newData, createdAt: h.createdAt })),
    onboardingProgress,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  // Blueprint §20: suspend/activate tenant = aksi kritis, wajib step-up
  if (!(await assertStepUp(req, session.id))) {
    return NextResponse.json(
      { error: 'Verifikasi ulang diperlukan untuk mengubah status tenant', stepUpRequired: true },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await req.json();
  const { status: newStatus } = body;

  if (!newStatus) return NextResponse.json({ error: 'status wajib' }, { status: 400 });

  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 });

  const allowed = VALID_TRANSITIONS[tenant.status] || [];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json({ error: `Transisi dari ${tenant.status} ke ${newStatus} tidak diizinkan` }, { status: 400 });
  }

  const updated = await prisma.tenant.update({
    where: { id },
    data: {
      status: newStatus as 'ACTIVE' | 'SUSPENDED' | 'PROSPECT' | 'PENDING_APPROVAL' | 'ONBOARDING' | 'UAT' | 'GRACE_PERIOD' | 'OFFBOARDING' | 'ARCHIVED',
      active: !['SUSPENDED', 'ARCHIVED', 'OFFBOARDING'].includes(newStatus),
    },
  });

  await logAudit(session, `LIFECYCLE_${tenant.status}_TO_${newStatus}`, 'TENANT', {
    oldData: { id: tenant.id, name: tenant.name, status: tenant.status },
    newData: { status: newStatus, active: updated.active },
  }, req);

  return NextResponse.json(updated);
}
