// src/lib/webhook-delivery.ts
// Webhook delivery engine — signs, sends, and logs deliveries.
import crypto from 'crypto';
import { prisma } from './prisma';
import { enqueue, registerJobHandler } from './job-queue';

export async function dispatchWebhooks(tenantId: string, event: string, payload: Record<string, unknown>) {
  const subs = await prisma.webhookSubscription.findMany({
    where: { tenantId, active: true, events: { has: event } },
  });

  for (const sub of subs) {
    enqueue('WEBHOOK_DELIVER', {
      subscriptionId: sub.id,
      url: sub.url,
      secret: sub.secret,
      event,
      payload,
    } as unknown as Record<string, unknown>);
  }
}

registerJobHandler('WEBHOOK_DELIVER', async (job) => {
  const { subscriptionId, url, secret, event, payload } = job.payload as {
    subscriptionId: string; url: string; secret: string | null; event: string; payload: Record<string, unknown>;
  };

  const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (secret) {
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
    headers['X-Webhook-Signature'] = `sha256=${signature}`;
  }

  const startTime = Date.now();
  try {
    const res = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(15000) });
    const durationMs = Date.now() - startTime;
    const responseBody = await res.text().catch(() => '');

    await prisma.webhookDelivery.create({
      data: {
        subscriptionId, event, payload: payload as never,
        statusCode: res.status, responseBody: responseBody.slice(0, 2000),
        attempt: job.attempt, status: res.ok ? 'DELIVERED' : 'FAILED',
        deliveredAt: res.ok ? new Date() : null,
      },
    });

    if (!res.ok && job.attempt < job.maxAttempts) {
      const nextRetry = new Date(Date.now() + Math.pow(2, job.attempt) * 60000);
      await prisma.webhookDelivery.updateMany({
        where: { subscriptionId, event, status: 'FAILED' },
        data: { nextRetryAt: nextRetry },
      });
    }
  } catch (err: unknown) {
    await prisma.webhookDelivery.create({
      data: {
        subscriptionId, event, payload: payload as never,
        attempt: job.attempt, status: 'FAILED',
        responseBody: err instanceof Error ? err.message : String(err),
      },
    });
  }
});
