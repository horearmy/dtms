import { prisma } from './prisma';
import { STATUS_LABELS, formatDateTime } from './constants';

const WA_API = 'https://graph.facebook.com/v21.0';

function config() {
  return {
    enabled: process.env.WHATSAPP_ENABLED === 'true',
    token: process.env.WHATSAPP_API_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    webhookToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
    adminNumbers: (process.env.WHATSAPP_ADMIN_NUMBERS || '')
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean),
  };
}

export function isWhatsAppEnabled() {
  return config().enabled && !!config().token && !!config().phoneNumberId;
}

export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return '62' + digits.slice(1);
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('+')) return digits.slice(1);
  return '62' + digits;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendTextMessage(to: string, text: string): Promise<SendResult> {
  const c = config();
  if (!c.enabled || !c.token || !c.phoneNumberId) {
    return { success: false, error: 'WhatsApp not configured' };
  }

  const phone = toE164(to);
  const truncated = text.length > 4096 ? text.slice(0, 4093) + '...' : text;

  try {
    const res = await fetch(`${WA_API}/${c.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: truncated },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[WA] Send failed:', data);
      return { success: false, error: data?.error?.message || 'Unknown error' };
    }

    const msgId = data?.messages?.[0]?.id;
    return { success: true, messageId: msgId };
  } catch (err) {
    console.error('[WA] Send error:', err);
    return { success: false, error: String(err) };
  }
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  langCode: string,
  params?: string[]
): Promise<SendResult> {
  const c = config();
  if (!c.enabled || !c.token || !c.phoneNumberId) {
    return { success: false, error: 'WhatsApp not configured' };
  }

  const phone = toE164(to);
  const components = params?.length
    ? [
        {
          type: 'body',
          parameters: params.map((p) => ({ type: 'text', text: p })),
        },
      ]
    : [];

  try {
    const res = await fetch(`${WA_API}/${c.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: langCode },
          ...(components.length ? { components } : {}),
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[WA] Template send failed:', data);
      return { success: false, error: data?.error?.message || 'Unknown error' };
    }

    const msgId = data?.messages?.[0]?.id;
    return { success: true, messageId: msgId };
  } catch (err) {
    console.error('[WA] Template send error:', err);
    return { success: false, error: String(err) };
  }
}

export async function sendShipmentStatusUpdate(
  trackingNumber: string,
  status: string,
  receiverPhone: string,
  receiverName: string,
  destination: string,
  eta?: Date | null
) {
  const statusLabel = STATUS_LABELS[status] || status;
  const etaStr = eta ? formatDateTime(eta) : 'Menunggu update';
  const trackingUrl = `${process.env.APP_URL || ''}/tracking/${trackingNumber}`;

  const message = [
    `Halo ${receiverName},`,
    ``,
    `Paket Anda dengan nomor resi:`,
    `*${trackingNumber}*`,
    ``,
    `Status: *${statusLabel}*`,
    `Tujuan: ${destination}`,
    `Estimasi tiba: ${etaStr}`,
    ``,
    `Lacak paket Anda di:`,
    trackingUrl,
    ``,
    `Terima kasih telah menggunakan layanan kami.`,
  ].join('\n');

  return sendTextMessage(receiverPhone, message);
}

export async function sendSLABreachAlert(
  trackingNumber: string,
  receiverName: string,
  deadline: Date
) {
  const message = [
    `⚠️ *SLA Terlambat*`,
    ``,
    `Paket *${trackingNumber}* untuk ${receiverName}`,
    `melewati deadline pada ${formatDateTime(deadline)}.`,
    ``,
    `Segera lakukan tindakan korektif.`,
  ].join('\n');

  const c = config();
  const results = await Promise.allSettled(
    c.adminNumbers.map((num) => sendTextMessage(num, message))
  );
  return results;
}

export async function sendGPSDisconnectAlert(
  driverName: string,
  lastMinutes: number,
  lat: number,
  lng: number
) {
  const message = [
    `🔴 *GPS Driver Terputus*`,
    ``,
    `Driver: *${driverName}*`,
    `Posisi terakhir: ${lastMinutes} menit lalu`,
    `Koordinat: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    ``,
    `Segera verifikasi kondisi driver.`,
  ].join('\n');

  const c = config();
  const results = await Promise.allSettled(
    c.adminNumbers.map((num) => sendTextMessage(num, message))
  );
  return results;
}

export async function sendDeliveryFailedAlert(
  trackingNumber: string,
  receiverName: string,
  reason: string
) {
  const message = [
    `❌ *Pengiriman Gagal*`,
    ``,
    `Paket *${trackingNumber}* untuk ${receiverName}`,
    `gagal dikirim.`,
    ``,
    `Alasan: ${reason}`,
    ``,
    `Status telah diperbarui. Silakan cek dashboard untuk tindakan lanjut.`,
  ].join('\n');

  const c = config();
  const results = await Promise.allSettled(
    c.adminNumbers.map((num) => sendTextMessage(num, message))
  );
  return results;
}

export async function logWhatsAppMessage(
  direction: 'OUTBOUND' | 'INBOUND',
  to: string,
  message: string,
  status: string,
  messageId?: string,
  shipmentId?: string
) {
  try {
    await prisma.notification.create({
      data: {
        shipmentId: shipmentId || null,
        message: `[WA ${direction}] ke ${to}: ${message.slice(0, 200)}... [${status}]`,
        status: status === 'sent' ? 'READ' : 'UNREAD',
      },
    });
  } catch {
    // silently fail - notification logging is non-critical
  }
}

export function getWhatsAppConfig() {
  const c = config();
  return {
    enabled: c.enabled,
    configured: !!(c.token && c.phoneNumberId),
    phoneNumberId: c.phoneNumberId,
    businessAccountId: c.businessAccountId,
    adminNumbers: c.adminNumbers,
  };
}
