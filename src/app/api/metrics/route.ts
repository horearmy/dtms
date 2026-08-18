// src/app/api/metrics/route.ts
// Prometheus-compatible metrics endpoint.
import { NextResponse } from 'next/server';
import { collectMetrics, collectSystemMetrics } from '@/lib/metrics';
import { getStats } from '@/lib/job-queue';
import { guard } from '@/lib/api-guard';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { session, error } = await guard('SUPER_ADMIN');
  if (error) return error;
  collectSystemMetrics();

  // Add job queue metrics
  const queue = getStats();
  const { gauge } = await import('@/lib/metrics');
  gauge('dtms_queue_pending', 'Pending jobs', {}, queue.pending);
  gauge('dtms_queue_running', 'Running jobs', {}, queue.running);
  gauge('dtms_queue_completed', 'Completed jobs', {}, queue.completed);
  gauge('dtms_queue_failed', 'Failed jobs', {}, queue.failed);

  const body = collectMetrics();

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    },
  });
}
