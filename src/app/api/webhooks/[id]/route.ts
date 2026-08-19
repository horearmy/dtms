// src/app/api/webhooks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/permissions';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardPermission(PERMISSIONS.WEBHOOK.UPDATE);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const { id } = await params;
    const body = await req.json();

    await prisma.webhookSubscription.updateMany({
      where: { id },
      data: { url: body.url, events: body.events, active: body.active },
    });

    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardPermission(PERMISSIONS.WEBHOOK.DELETE);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const { id } = await params;

    await prisma.webhookSubscription.deleteMany({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  });
}
