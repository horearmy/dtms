import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function GET(req: NextRequest) {
  const { session, error } = await guard();
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
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'WAREHOUSE', 'SUPERVISOR');
  if (error) return error;

  const body = await req.json();
  const { shipmentId, type, severity, title, description, dueAt } = body;

  if (!type || !title) {
    return NextResponse.json({ error: 'type dan title wajib diisi' }, { status: 400 });
  }

  const exception = await prisma.exception.create({
    data: {
      tenantId: session?.tenantId || '',
      shipmentId: shipmentId || null,
      type,
      severity: severity || 'MEDIUM',
      title: String(title).slice(0, 200),
      description: description ? String(description).slice(0, 2000) : null,
      dueAt: dueAt ? new Date(dueAt) : null,
      createdBy: session?.id || null,
    },
  });

  return NextResponse.json(exception, { status: 201 });
}
