import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function GET() {
  const { session, error } = await guard();
  if (error) return error;

  const policies = await prisma.slaPolicy.findMany({
    where: session?.tenantId ? { tenantId: session.tenantId } : {},
    orderBy: [{ serviceType: 'asc' }, { priority: 'desc' }],
  });

  return NextResponse.json(policies);
}

export async function POST(req: NextRequest) {
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL');
  if (error) return error;

  const body = await req.json();
  const { name, serviceType, originCity, destCity, targetHours, cutoffTime, priority } = body;

  if (!name || !targetHours) {
    return NextResponse.json({ error: 'name dan targetHours wajib diisi' }, { status: 400 });
  }

  const policy = await prisma.slaPolicy.create({
    data: {
      tenantId: session?.tenantId || '',
      name: String(name).slice(0, 100),
      serviceType: serviceType || 'REGULAR',
      originCity: originCity ? String(originCity).slice(0, 100) : null,
      destCity: destCity ? String(destCity).slice(0, 100) : null,
      targetHours: parseInt(targetHours),
      cutoffTime: cutoffTime ? String(cutoffTime).slice(0, 5) : null,
      priority: priority ? parseInt(priority) : 0,
    },
  });

  return NextResponse.json(policy, { status: 201 });
}
