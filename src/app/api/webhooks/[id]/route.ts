// src/app/api/webhooks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guard, guardPermission } from '@/lib/api-guard';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guard();
  if (error) return error;
  const perm = await guardPermission('settings.edit');
  if (perm.error) return perm.error;
  const { id } = await params;
  const body = await req.json();

  await prisma.webhookSubscription.updateMany({
    where: { id, ...(session?.tenantId ? { tenantId: session.tenantId } : {}) },
    data: { url: body.url, events: body.events, active: body.active },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guard();
  if (error) return error;
  const perm = await guardPermission('settings.delete');
  if (perm.error) return perm.error;
  const { id } = await params;

  await prisma.webhookSubscription.deleteMany({
    where: { id, ...(session?.tenantId ? { tenantId: session.tenantId } : {}) },
  });

  return NextResponse.json({ ok: true });
}
