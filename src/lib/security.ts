import { NextRequest } from 'next/server';
import { prisma } from './prisma';

const MAX_USER_FAILURES = Number(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const MAX_IP_FAILURES = 20;
const WINDOW_MIN = 15;
const CLEANUP_OLDER_HOURS = 24;
const EXPONENTIAL_BACKOFF_THRESHOLD = 3;

export function getClientIp(req: NextRequest) {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'local';
}

function getEffectiveWindow(failureCount: number): number {
  if (failureCount >= EXPONENTIAL_BACKOFF_THRESHOLD) {
    const multiplier = Math.pow(2, failureCount - EXPONENTIAL_BACKOFF_THRESHOLD + 1);
    return WINDOW_MIN * multiplier;
  }
  return WINDOW_MIN;
}

export async function isLoginBlocked(key: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MIN * 60000 * 5);
  const [byUsername, byIp] = await Promise.all([
    prisma.loginAttempt.count({ where: { username: key, success: false, createdAt: { gte: since } } }),
    prisma.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } }),
  ]);
  const maxWindow = Math.max(getEffectiveWindow(byUsername), getEffectiveWindow(byIp));
  const cutoff = new Date(Date.now() - maxWindow * 60000);
  const [recentUsername, recentIp] = await Promise.all([
    prisma.loginAttempt.count({ where: { username: key, success: false, createdAt: { gte: cutoff } } }),
    prisma.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: cutoff } } }),
  ]);
  return recentUsername >= MAX_USER_FAILURES || recentIp >= MAX_IP_FAILURES;
}

export async function getRemainingAttempts(username: string, ip: string): Promise<number> {
  const since = new Date(Date.now() - WINDOW_MIN * 60000 * 5);
  const [byUsername, byIp] = await Promise.all([
    prisma.loginAttempt.count({ where: { username, success: false, createdAt: { gte: since } } }),
    prisma.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } }),
  ]);
  const remainingByUser = Math.max(0, MAX_USER_FAILURES - byUsername);
  const remainingByIp = Math.max(0, MAX_IP_FAILURES - byIp);
  return Math.min(remainingByUser, remainingByIp);
}

export async function getLockoutDuration(username: string, ip: string): Promise<number> {
  const since = new Date(Date.now() - WINDOW_MIN * 60000 * 5);
  const [byUsername, byIp] = await Promise.all([
    prisma.loginAttempt.count({ where: { username, success: false, createdAt: { gte: since } } }),
    prisma.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } }),
  ]);
  const userWindow = getEffectiveWindow(byUsername);
  const ipWindow = getEffectiveWindow(byIp);
  const largerCount = byUsername >= byIp ? byUsername : byIp;
  const effectiveWindow = byUsername >= byIp ? userWindow : ipWindow;
  if (largerCount < MAX_USER_FAILURES && largerCount < MAX_IP_FAILURES) return 0;

  const newestFailure = await prisma.loginAttempt.findFirst({
    where: { OR: [{ username, success: false }, { ip, success: false }] },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (!newestFailure) return 0;

  const expiresAt = newestFailure.createdAt.getTime() + effectiveWindow * 60000;
  const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  return remaining;
}

export async function recordLoginAttempt(username: string, ip: string, success: boolean) {
  await prisma.loginAttempt.create({ data: { username, ip, success } });
}

export async function cleanupLoginAttempts() {
  const older = new Date(Date.now() - CLEANUP_OLDER_HOURS * 3600000);
  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: older } } });
}

export function validatePassword(pw: string): { valid: boolean; error?: string } {
  if (!pw || pw.length < 8) return { valid: false, error: 'Password minimal 8 karakter' };
  if (!/[A-Z]/.test(pw)) return { valid: false, error: 'Password harus mengandung huruf besar' };
  if (!/[a-z]/.test(pw)) return { valid: false, error: 'Password harus mengandung huruf kecil' };
  if (!/[0-9]/.test(pw)) return { valid: false, error: 'Password harus mengandung angka' };
  return { valid: true };
}

export function generateRandomPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;

  const pick = (chars: string, count: number) => {
    let result = '';
    const bytes = crypto.getRandomValues(new Uint8Array(count));
    for (let i = 0; i < count; i++) result += chars[bytes[i] % chars.length];
    return result;
  };

  const mandatory = pick(upper, 1) + pick(lower, 1) + pick(digits, 1);
  const rest = pick(all, length - 3);
  const combined = (mandatory + rest).split('');

  const shuffle = crypto.getRandomValues(new Uint8Array(combined.length));
  for (let i = combined.length - 1; i > 0; i--) {
    const j = shuffle[i] % (i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.join('');
}

// Rate limiting — uses Redis if UPSTASH_REDIS_REST_URL is set, otherwise in-memory
type RateLimitEntry = { count: number; resetAt: number };
const rateLimitStore = new Map<string, RateLimitEntry>();

function cleanupRateLimits() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now >= entry.resetAt) rateLimitStore.delete(key);
  }
}

async function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const { Redis } = await import('@upstash/redis').catch(() => ({ Redis: null as any }));
  if (!Redis) return null;
  return new Redis({ url, token });
}

export async function checkRateLimit(key: string, maxRequests: number, windowMs: number): Promise<boolean> {
  const redis = await getRedis();
  if (redis) {
    try {
      const current = await redis.incr(`rl:${key}`);
      if (current === 1) {
        await redis.pexpire(`rl:${key}`, windowMs);
      }
      return current <= maxRequests;
    } catch {
      // Fall through to in-memory
    }
  }
  cleanupRateLimits();
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now >= entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}
