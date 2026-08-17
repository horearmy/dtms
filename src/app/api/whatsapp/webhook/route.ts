import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logWhatsAppMessage } from '@/lib/whatsapp';

export async function GET(req: NextRequest) {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '';
  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge || '', { status: 200 });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entries = body?.entry || [];

    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;

        const value = change.value || {};
        const messages = value.messages || [];
        const statuses = value.statuses || [];

        for (const msg of messages) {
          const from = msg.from || '';
          const text = msg.text?.body || '';
          const msgId = msg.id || '';

          await logWhatsAppMessage('INBOUND', from, text, 'received', msgId);

          await prisma.notification.create({
            data: {
              message: `[WA Masuk] dari ${from}: ${text.slice(0, 200)}`,
              status: 'UNREAD',
            },
          });
        }

        for (const st of statuses) {
          const msgId = st.id || '';
          const stStatus = st.status || '';
          const stTimestamp = st.timestamp || '';

          await logWhatsAppMessage('OUTBOUND', '', `[${stStatus}] ${msgId}`, stStatus, msgId);
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('[WA Webhook] Error:', err);
    return NextResponse.json({ status: 'ok' });
  }
}
