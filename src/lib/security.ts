import { NextRequest } from 'next/server';
import { prisma } from './prisma';

const MAX_USER_FAILURES = 5;
const MAX_IP_FAILURES = 20;
const WINDOW_MIN = 15;
const CLEANUP_OLDER_HOURS = 24;

export function getClientIp(req: NextRequest) {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'local';
}

export async function isLoginBlocked(key: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MIN * 60000);
  const [byUsername, byIp] = await Promise.all([
    prisma.loginAttempt.count({ where: { username: key, success: false, createdAt: { gte: since } } }),
    prisma.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } }),
  ]);
  return byUsername >= MAX_USER_FAILURES || byIp >= MAX_IP_FAILURES;
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
