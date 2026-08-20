import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const DEFAULT_STEPS = [
  { step: 'create_tenant', label: 'Buat Akun Tenant', description: 'Buat akun tenant baru', order: 1 },
  { step: 'setup_profile', label: 'Setup Profil', description: 'Lengkapi informasi profil perusahaan', order: 2 },
  { step: 'invite_users', label: 'Undang Pengguna', description: 'Undang anggota tim', order: 3 },
  { step: 'create_branch', label: 'Buat Branch', description: 'Buat minimal satu branch', order: 4 },
  { step: 'setup_driver', label: 'Setup Driver', description: 'Tambah driver dan kendaraan', order: 5 },
  { step: 'create_shipment', label: 'Buat Shipment Pertama', description: 'Buat shipment test', order: 6 },
  { step: 'setup_geofence', label: 'Setup Geofence', description: 'Buat area geofence', order: 7 },
  { step: 'configure_integration', label: 'Konfigurasi Integrasi', description: 'Setup integrasi eksternal', order: 8 },
];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const { id } = await params;
  const steps = await prisma.tenantOnboarding.findMany({
    where: { tenantId: id },
    orderBy: { order: 'asc' },
  });

  if (steps.length === 0) {
    return NextResponse.json({ steps: DEFAULT_STEPS.map(s => ({ ...s, status: 'PENDING', id: null, completedAt: null })), progress: 0 });
  }

  const completed = steps.filter(s => s.status === 'COMPLETED').length;
  const progress = Math.round((completed / DEFAULT_STEPS.length) * 100);

  return NextResponse.json({ steps, progress });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { step, status, data } = body;

  if (!step || !status) return NextResponse.json({ error: 'step dan status wajib' }, { status: 400 });
  if (!['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'FAILED'].includes(status)) {
    return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 });
  }

  const stepDef = DEFAULT_STEPS.find(s => s.step === step);
  if (!stepDef) return NextResponse.json({ error: 'Step tidak valid' }, { status: 400 });

  const updated = await prisma.tenantOnboarding.upsert({
    where: { tenantId_step: { tenantId: id, step } },
    update: {
      status,
      completedAt: status === 'COMPLETED' ? new Date() : null,
      data: data || undefined,
    },
    create: {
      tenantId: id,
      step,
      label: stepDef.label,
      description: stepDef.description,
      order: stepDef.order,
      status,
      completedAt: status === 'COMPLETED' ? new Date() : null,
      data: data || undefined,
    },
  });

  if (status === 'COMPLETED') {
    const allSteps = await prisma.tenantOnboarding.findMany({ where: { tenantId: id } });
    const allDone = DEFAULT_STEPS.every(ds => allSteps.some(s => s.step === ds.step && s.status === 'COMPLETED'));
    if (allDone) {
      await prisma.tenant.update({ where: { id }, data: { status: 'ACTIVE' } });
    }
  }

  return NextResponse.json(updated);
}
