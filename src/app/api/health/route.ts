// src/app/api/health/route.ts
// Health check endpoint for observability.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStats } from '@/lib/job-queue';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, string> = {};
  let healthy = true;

  // Database check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
    healthy = false;
  }

  // Queue stats
  const queue = getStats();
  checks.queue = `pending=${queue.pending} running=${queue.running} failed=${queue.failed}`;

  // Memory
  const mem = process.memoryUsage();
  checks.memory = `heap=${Math.round(mem.heapUsed / 1024 / 1024)}MB rss=${Math.round(mem.rss / 1024 / 1024)}MB`;

  // Uptime
  const uptime = Math.round(process.uptime());

  return NextResponse.json(
    { status: healthy ? 'healthy' : 'degraded', uptime, checks, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503 },
  );
}
