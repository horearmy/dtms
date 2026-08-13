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

export function validatePassword(pw: string): string | null {
  if (!pw || pw.length < 8) return 'Password minimal 8 karakter';
  if (!/[A-Z]/.test(pw)) return 'Password harus mengandung huruf besar';
  if (!/[a-z]/.test(pw)) return 'Password harus mengandung huruf kecil';
  if (!/[0-9]/.test(pw)) return 'Password harus mengandung angka';
  return null;
}
