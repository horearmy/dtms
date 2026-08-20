// src/app/api/webhooks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/permissions';
import { isUrlSafe } from '@/lib/security';
import crypto from 'crypto';

export async function GET() {
  const { session, error } = await guardPermission(PERMISSIONS.WEBHOOK.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const webhooks = await prisma.webhookSubscription.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(webhooks.map((w) => ({
      id: w.id, url: w.url, events: w.events, active: w.active, createdAt: w.createdAt,
    })));
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.WEBHOOK.CREATE);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    if (!body.url) {
      return NextResponse.json({ error: 'URL wajib diisi' }, { status: 400 });
    }
    const urlCheck = isUrlSafe(body.url.toString());
    if (!urlCheck.safe) {
      return NextResponse.json({ error: urlCheck.reason }, { status: 400 });
    }
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
  });
}
