import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.NOTIFICATION.SEND, 'SUPER_ADMIN');
  if (error) return error;

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { tenantId, title, message, type } = body;

  if (!tenantId || !title || !message) {
    return NextResponse.json({ error: 'tenantId, title, and message are required' }, { status: 400 });
  }

  if (title.length > 200) {
    return NextResponse.json({ error: 'Title too long (max 200 chars)' }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: 'Message too long (max 2000 chars)' }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  return runWithTenant(tenantId, async () => {
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true },
    });

    if (users.length === 0) {
      return NextResponse.json({ error: 'No users in this tenant' }, { status: 400 });
    }

    const validType = ['INFO', 'WARNING', 'SUCCESS', 'UPGRADE'].includes(type) ? type : 'INFO';

    const notifications = await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        tenantId,
        title,
        message,
        type: validType,
        status: 'UNREAD',
        metadata: { source: 'platform_intelligence', sentBy: session?.id },
      })),
    });

    await logAudit(session, 'SEND_TENANT_NOTIFICATION', 'NOTIFICATION', `Sent "${title}" to ${tenant.name} (${users.length} users)`, req);

    return NextResponse.json({ ok: true, sent: notifications.count, tenantName: tenant.name });
  });
}
