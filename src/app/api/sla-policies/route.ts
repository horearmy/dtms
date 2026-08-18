import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

const VALID_SERVICE_TYPES = ['SAME_DAY', 'NEXT_DAY', 'REGULAR'] as const;

export async function GET() {
  const { session, scope, error } = await guardPermission(PERMISSIONS.SLA.READ);
  if (error) return error;

  const policies = await prisma.slaPolicy.findMany({
    where: session?.tenantId ? { tenantId: session.tenantId } : {},
    orderBy: [{ serviceType: 'asc' }, { priority: 'desc' }],
  });

  return NextResponse.json(policies);
}

export async function POST(req: NextRequest) {
  const { session, scope, error } = await guardPermission(PERMISSIONS.SLA.CREATE);
  if (error) return error;

  const body = await req.json();
  const { name, serviceType, originCity, destCity, targetHours, cutoffTime, priority } = body;

  const trimmedName = name ? String(name).trim().slice(0, 100) : '';
  if (!trimmedName) {
    return NextResponse.json({ error: 'name wajib diisi' }, { status: 400 });
  }

  const parsedTargetHours = Number(targetHours);
  if (targetHours == null || isNaN(parsedTargetHours) || parsedTargetHours <= 0 || !Number.isInteger(parsedTargetHours)) {
    return NextResponse.json({ error: 'targetHours wajib diisi dan harus bilangan bulat positif' }, { status: 400 });
  }

  const trimmedServiceType = serviceType ? String(serviceType).trim() : 'REGULAR';
  if (!(VALID_SERVICE_TYPES as readonly string[]).includes(trimmedServiceType)) {
    return NextResponse.json({ error: `serviceType tidak valid. Nilai yang diizinkan: ${VALID_SERVICE_TYPES.join(', ')}` }, { status: 400 });
  }

  const trimmedOriginCity = originCity ? String(originCity).trim().slice(0, 100) : null;
  const trimmedDestCity = destCity ? String(destCity).trim().slice(0, 100) : null;
  const trimmedCutoffTime = cutoffTime ? String(cutoffTime).trim().slice(0, 5) : null;
  const parsedPriority = priority != null ? parseInt(String(priority)) : 0;
  if (isNaN(parsedPriority)) {
    return NextResponse.json({ error: 'priority harus berupa angka' }, { status: 400 });
  }

  const policy = await prisma.slaPolicy.create({
    data: {
      tenantId: session?.tenantId || '',
      name: trimmedName,
      serviceType: trimmedServiceType as never,
      originCity: trimmedOriginCity,
      destCity: trimmedDestCity,
      targetHours: parsedTargetHours,
      cutoffTime: trimmedCutoffTime,
      priority: parsedPriority,
    },
  });

  await logAudit(session, 'CREATE_SLA_POLICY', 'SLA', { newData: { name, serviceType } }, req);

  return NextResponse.json(policy, { status: 201 });
}
