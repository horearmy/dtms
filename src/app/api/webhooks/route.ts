// src/app/api/webhooks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guard, guardPermission } from '@/lib/api-guard';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function GET() {
  const { session, error } = await guard();
  if (error) return error;
  const perm = await guardPermission('settings.view');
  if (perm.error) return perm.error;

  const webhooks = await prisma.webhookSubscription.findMany({
    where: session?.tenantId ? { tenantId: session.tenantId } : {},
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(webhooks.map((w) => ({
    id: w.id, url: w.url, events: w.events, active: w.active, createdAt: w.createdAt,
  })));
}

export async function POST(req: NextRequest) {
  const { session, error } = await guard();
  if (error) return error;
  const perm = await guardPermission('settings.edit');
  if (perm.error) return perm.error;

  const body = await req.json();
  const secret = body.secret || crypto.randomBytes(32).toString('hex');

  const webhook = await prisma.webhookSubscription.create({
    data: {
      tenantId: session!.tenantId!,
      url: body.url,
      events: body.events || ['*'],
      secret,
      active: true,
    },
  });

  return NextResponse.json({ ...webhook, secret }, { status: 201 });
}
