import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { sendTextMessage, sendShipmentStatusUpdate, isWhatsAppEnabled, logWhatsAppMessage } from '@/lib/whatsapp';
import { STATUS_LABELS } from '@/lib/constants';

const MANAGE = ['SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'WAREHOUSE', 'CUSTOMER_SERVICE', 'SUPERVISOR'];

export async function POST(req: NextRequest) {
  const { session, error } = await guard(...MANAGE);
  if (error) return error;

  if (!isWhatsAppEnabled()) {
    return NextResponse.json({ error: 'WhatsApp belum dikonfigurasi' }, { status: 400 });
  }

  const body = await req.json();
  const { to, message, shipmentId, type } = body || {};

  if (!to || !message) {
    return NextResponse.json({ error: 'Nomor tujuan dan pesan wajib diisi' }, { status: 400 });
  }

  const result = await sendTextMessage(to, message);

  await logWhatsAppMessage('OUTBOUND', to, message, result.success ? 'sent' : 'failed', result.messageId, shipmentId);

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Gagal mengirim pesan' }, { status: 500 });
  }

  return NextResponse.json({ success: true, messageId: result.messageId });
}

export async function GET() {
  const { session, error } = await guard(...MANAGE);
  if (error) return error;

  const { getWhatsAppConfig } = await import('@/lib/whatsapp');
  return NextResponse.json(getWhatsAppConfig());
}
