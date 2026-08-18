import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { broadcast } from '@/lib/sse-bus';

const VALID_EXCEPTION_TYPES = [
  'DELIVERY_FAILED', 'ADDRESS_UNREACHABLE', 'CUSTOMER_UNAVAILABLE', 'DAMAGED_GOODS',
  'LOST_PACKAGE', 'SLA_BREACH', 'VEHICLE_BREAKDOWN', 'DRIVER_ISSUE',
  'ROUTE_DEVIATION', 'WEATHER', 'OTHER',
] as const;

const VALID_EXCEPTION_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export async function GET(req: NextRequest) {
  const { session, scope, error } = await guardPermission(PERMISSIONS.EXCEPTION.READ);
  if (error) return error;

  const url = req.nextUrl.searchParams;
  const status = url.get('status') || '';
  const severity = url.get('severity') || '';
  const page = Math.max(1, parseInt(url.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.get('limit') || '20', 10)));

  const where: Record<string, unknown> = {};
  if (session?.tenantId) where.tenantId = session.tenantId;
  if (status) where.status = status;
  if (severity) where.severity = severity;

  const [exceptions, total] = await Promise.all([
    prisma.exception.findMany({
      where,
      include: {
        shipment: { select: { id: true, trackingNumber: true, destination: true } },
        owner: { select: { id: true, name: true } },
      },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.exception.count({ where }),
  ]);

  return NextResponse.json({ exceptions, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const { session, scope, error } = await guardPermission(PERMISSIONS.EXCEPTION.CREATE);
  if (error) return error;

  const body = await req.json();
  const { shipmentId, type, severity, title, description, dueAt } = body;

  const trimmedType = type ? String(type).trim() : '';
  if (!trimmedType || !(VALID_EXCEPTION_TYPES as readonly string[]).includes(trimmedType)) {
    return NextResponse.json({ error: `type wajib diisi dan harus salah satu dari: ${VALID_EXCEPTION_TYPES.join(', ')}` }, { status: 400 });
  }

  const trimmedTitle = title ? String(title).trim().slice(0, 200) : '';
  if (!trimmedTitle) {
    return NextResponse.json({ error: 'title wajib diisi' }, { status: 400 });
  }

  const trimmedSeverity = severity ? String(severity).trim() : 'MEDIUM';
  if (!(VALID_EXCEPTION_SEVERITIES as readonly string[]).includes(trimmedSeverity)) {
    return NextResponse.json({ error: `severity tidak valid. Nilai yang diizinkan: ${VALID_EXCEPTION_SEVERITIES.join(', ')}` }, { status: 400 });
  }

  const trimmedDescription = description ? String(description).trim().slice(0, 2000) : null;
  const sanitizedShipmentId = shipmentId ? String(shipmentId).trim() : null;

  const exception = await prisma.exception.create({
    data: {
      tenantId: session?.tenantId || '',
      shipmentId: sanitizedShipmentId,
      type: trimmedType as never,
      severity: trimmedSeverity as never,
      title: trimmedTitle,
      description: trimmedDescription,
      dueAt: dueAt ? new Date(dueAt) : null,
      createdBy: session?.id || null,
    },
  });

  const channel = session?.tenantId ? `tenant:${session.tenantId}` : 'global';
  broadcast(channel, 'exception:created', {
    id: exception.id,
    type: exception.type,
    severity: exception.severity,
    title: exception.title,
    createdAt: exception.createdAt.toISOString(),
  });
  broadcast(channel, 'control-tower:update', { type: 'exception' });

  await logAudit(session, 'CREATE_EXCEPTION', 'EXCEPTION', { newData: { type, title } }, req);

  return NextResponse.json(exception, { status: 201 });
}
