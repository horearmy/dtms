// src/lib/job-queue.ts
// In-memory job queue with pluggable backend.

type JobStatus = 'pending' | 'running' | 'completed' | 'failed';
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
const queue: Job[] = [];
const jobsById = new Map<string, Job>();
let processing = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

export function registerJobHandler(type: string, handler: Handler) {
  handlers.set(type, handler);
}

export function enqueue(type: string, payload: Record<string, unknown>, opts?: { maxAttempts?: number }): Job {
  const job: Job = {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    type,
    payload,
    status: 'pending',
    attempt: 0,
    maxAttempts: opts?.maxAttempts ?? 3,
    createdAt: Date.now(),
  };
  jobsById.set(job.id, job);
  queue.push(job);
  processNext();
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobsById.get(id);
}

export function getStats() {
  const jobs = Array.from(jobsById.values());
  return {
    total: jobs.length,
    pending: jobs.filter((j) => j.status === 'pending').length,
    running: jobs.filter((j) => j.status === 'running').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
  };
}

async function processNext() {
  if (processing) return;
  processing = true;
  while (queue.length > 0) {
    const job = queue.find((j) => j.status === 'pending');
    if (!job) break;
    const handler = handlers.get(job.type);
    if (!handler) {
      job.status = 'failed';
      job.error = `No handler for job type: ${job.type}`;
      job.completedAt = Date.now();
      continue;
    }
    job.status = 'running';
    job.attempt++;
    job.startedAt = Date.now();
    try {
      await handler(job);
      job.status = 'completed';
      job.completedAt = Date.now();
    } catch (err: unknown) {
      job.error = err instanceof Error ? err.message : String(err);
      if (job.attempt < job.maxAttempts) {
        job.status = 'pending';
      } else {
        job.status = 'failed';
        job.completedAt = Date.now();
      }
    }
  }
  processing = false;
}

// Start a periodic drain every 5 seconds (for retries)
export function startQueueWorker() {
  if (intervalId) return;
  intervalId = setInterval(() => processNext(), 5000);
}
