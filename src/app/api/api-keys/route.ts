// src/app/api/api-keys/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/permissions';
import crypto from 'crypto';

export async function GET() {
  const { session, error } = await guardPermission(PERMISSIONS.API_KEY.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const keys = await prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(keys.map((k) => ({
      id: k.id, name: k.name, keyPrefix: k.keyPrefix, scopes: k.scopes, active: k.active,
      lastUsed: k.lastUsed, expiresAt: k.expiresAt, createdAt: k.createdAt,
    })));
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.API_KEY.CREATE);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    const rawKey = `dtms_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.slice(0, 12);
    const VALID_SCOPES = ['read', 'write'];
    const scopes = (Array.isArray(body.scopes) ? body.scopes : ['read']).filter((s: unknown) => typeof s === 'string' && VALID_SCOPES.includes(s));
    if (!scopes.length) scopes.push('read');

    const apiKey = await prisma.apiKey.create({
      data: {
        tenantId: session!.tenantId!,
        name: body.name,
        keyHash,
        keyPrefix,
        scopes,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });

    return NextResponse.json({
      id: apiKey.id, name: apiKey.name, keyPrefix: apiKey.keyPrefix,
      key: rawKey,
      scopes: apiKey.scopes, expiresAt: apiKey.expiresAt,
    }, { status: 201 });
  });
}
