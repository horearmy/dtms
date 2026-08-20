import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const { id } = await params;
  const wl = await prisma.whiteLabel.findUnique({ where: { tenantId: id } });
  return NextResponse.json(wl || { tenantId: id, active: false });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 });

  const fields = [
    'appName', 'logoUrl', 'faviconUrl', 'primaryColor', 'secondaryColor', 'accentColor',
    'loginBgUrl', 'emailFromName', 'emailFromAddress', 'smsProvider', 'customCss',
    'customDomain', 'landingPageHtml',
  ];

  const updateData: Record<string, unknown> = {};
  for (const f of fields) {
    if (body[f] !== undefined) updateData[f] = body[f] || null;
  }
  if (body.emailTemplate !== undefined) updateData.emailTemplate = body.emailTemplate || null;
  if (body.smsConfig !== undefined) updateData.smsConfig = body.smsConfig || null;
  if (body.active !== undefined) updateData.active = Boolean(body.active);

  const existing = await prisma.whiteLabel.findUnique({ where: { tenantId: id } });

  let wl;
  if (existing) {
    wl = await prisma.whiteLabel.update({ where: { tenantId: id }, data: updateData });
  } else {
    wl = await prisma.whiteLabel.create({
      data: {
        tenantId: id,
        appName: body.appName || null,
        logoUrl: body.logoUrl || null,
        faviconUrl: body.faviconUrl || null,
        primaryColor: body.primaryColor || null,
        secondaryColor: body.secondaryColor || null,
        accentColor: body.accentColor || null,
        loginBgUrl: body.loginBgUrl || null,
        emailFromName: body.emailFromName || null,
        emailFromAddress: body.emailFromAddress || null,
        smsProvider: body.smsProvider || null,
        customCss: body.customCss || null,
        customDomain: body.customDomain || null,
        landingPageHtml: body.landingPageHtml || null,
        emailTemplate: body.emailTemplate || null,
        smsConfig: body.smsConfig || null,
        active: body.active !== false,
      },
    });
  }

  return NextResponse.json(wl);
}
