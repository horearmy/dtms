// src/lib/job-queue.ts
// Persistent Postgres-backed job queue.
// - Tahan restart: job tersimpan di tabel JobQueue, bukan memori proses.
// - Aman multi-instance: klaim atomik via FOR UPDATE SKIP LOCKED.
import { prisma } from './prisma';
import { logger } from './logger';
import type { Prisma } from '@prisma/client';

const log = logger.child('job-queue');

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Job {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempt: number;
  maxAttempts: number;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

type Handler = (job: Job) => Promise<void>;
const handlers = new Map<string, Handler>();
let processing = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
let ticks = 0;

// Identitas instance untuk debugging klaim antar-replika
const INSTANCE_ID = `${process.pid}-${Date.now().toString(36)}`;

const CLAIM_BATCH = 10;
const STALE_RUNNING_MS = 5 * 60_000;

export function registerJobHandler(type: string, handler: Handler) {
  handlers.set(type, handler);
}

interface ClaimedRow {
  id: string;
  type: string;
  payload: Prisma.JsonValue;
  attempt: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

function rowToJob(r: {
  id: string;
  type: string;
  payload: Prisma.JsonValue;
  status?: string;
  attempt: number;
  maxAttempts: number;
  error?: string | null;
  createdAt: Date | number;
  startedAt?: Date | null | number;
  completedAt?: Date | null | number;
}): Job {
  return {
    id: r.id,
    type: r.type,
    payload: r.payload as Record<string, unknown>,
    status: (r.status as JobStatus) ?? 'running',
    attempt: r.attempt,
    maxAttempts: r.maxAttempts,
    error: r.error ?? undefined,
    createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : Number(r.createdAt),
    startedAt: r.startedAt ? (r.startedAt instanceof Date ? r.startedAt.getTime() : Number(r.startedAt)) : undefined,
    completedAt: r.completedAt ? (r.completedAt instanceof Date ? r.completedAt.getTime() : Number(r.completedAt)) : undefined,
  };
}

/**
 * Masukkan job ke antrian persisten. Fire-and-forget: kegagalan DB dicatat,
 * tidak melempar ke pemanggil (kontrak sama seperti versi in-memory).
 */
export function enqueue(
  type: string,
  payload: Record<string, unknown>,
  opts?: { maxAttempts?: number }
): void {
  void prisma.jobQueue
    .create({
      data: {
        type,
        payload: payload as Prisma.InputJsonValue,
        maxAttempts: opts?.maxAttempts ?? 3,
      },
    })
    .catch((e: unknown) => {
      log.error('enqueue gagal', { type, error: String(e) });
    });
}

export async function getJob(id: string): Promise<Job | undefined> {
  const row = await prisma.jobQueue.findUnique({ where: { id } });
  return row ? rowToJob(row) : undefined;
}

export async function getStats() {
  const grouped = await prisma.jobQueue.groupBy({ by: ['status'], _count: { _all: true } });
  const byStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
  return {
    total: grouped.reduce((acc, g) => acc + g._count._all, 0),
    pending: byStatus.get('pending') ?? 0,
    running: byStatus.get('running') ?? 0,
    completed: byStatus.get('completed') ?? 0,
    failed: byStatus.get('failed') ?? 0,
  };
}

async function claimJobs(limit: number): Promise<Job[]> {
  const rows = await prisma.$queryRaw<ClaimedRow[]>`
    UPDATE "JobQueue"
    SET status = 'running',
        "startedAt" = NOW(),
        "lockedAt" = NOW(),
        "lockedBy" = ${INSTANCE_ID},
        attempt = attempt + 1
    WHERE id IN (
      SELECT id FROM "JobQueue"
      WHERE status = 'pending' AND "runAfter" <= NOW()
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, type, payload, attempt, "maxAttempts", "createdAt", "startedAt", "completedAt"
  `;
  return rows.map((r) => rowToJob({ ...r, status: 'running' }));
}

async function runJob(job: Job): Promise<void> {
  const handler = handlers.get(job.type);
  if (!handler) {
    await prisma.jobQueue.update({
      where: { id: job.id },
      data: { status: 'failed', error: `No handler for job type: ${job.type}`, completedAt: new Date() },
    });
    return;
  }
  try {
    await handler(job);
    await prisma.jobQueue.update({
      where: { id: job.id },
      data: { status: 'completed', completedAt: new Date() },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (job.attempt < job.maxAttempts) {
      // Backoff eksponensial: 2s, 4s, 8s ... maksimum 60s
      const backoffMs = Math.min(60_000, 2_000 * 2 ** (job.attempt - 1));
      await prisma.jobQueue.update({
        where: { id: job.id },
        data: { status: 'pending', error: msg, runAfter: new Date(Date.now() + backoffMs) },
      });
    } else {
      await prisma.jobQueue.update({
        where: { id: job.id },
        data: { status: 'failed', error: msg, completedAt: new Date() },
      });
      log.warn('job gagal permanen', { jobId: job.id, type: job.type, error: msg });
    }
  }
}

async function processNext(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    for (;;) {
      const claimed = await claimJobs(CLAIM_BATCH);
      if (!claimed.length) break;
      for (const job of claimed) await runJob(job);
    }
  } catch (e) {
    log.error('worker loop error', { error: String(e) });
  } finally {
    processing = false;
  }
}

async function maintenanceTick(): Promise<void> {
  try {
    // Pulihkan job 'running' yang terbengkalai oleh instance yang mati/crash
    await prisma.jobQueue.updateMany({
      where: { status: 'running', lockedAt: { lt: new Date(Date.now() - STALE_RUNNING_MS) } },
      data: { status: 'pending', lockedAt: null, lockedBy: null },
    });
    // Bersihkan riwayat: selesai > 1 jam, gagal permanen > 24 jam
    const hourAgo = new Date(Date.now() - 3_600_000);
    const dayAgo = new Date(Date.now() - 86_400_000);
    await prisma.jobQueue.deleteMany({
      where: {
        OR: [
          { status: 'completed', completedAt: { lt: hourAgo } },
          { status: 'failed', completedAt: { lt: dayAgo } },
        ],
      },
    });
  } catch (e) {
    log.error('maintenance error', { error: String(e) });
  }
}

// Drain berkala setiap 5 detik (retry + job dari instance lain)
export function startQueueWorker() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    ticks++;
    if (ticks % 20 === 0) void maintenanceTick();
    void processNext();
  }, 5000);
}
