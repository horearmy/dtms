import { prisma } from './prisma';
import { createHash } from 'crypto';

/**
 * Risk engine heuristik untuk login Superadmin (Blueprint §18–19).
 * v1: deterministik, tanpa ML — input riwayat sesi + percobaan gagal + waktu.
 * CRITICAL sengaja belum dipakai; disiapkan utk fase block+alert.
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RiskAssessment = {
  level: RiskLevel;
  reasons: string[];
};

export type RiskInput = {
  userId: string;
  ip: string;
  userAgent: string | null;
};

function deviceHash(ua: string | null): string {
  return createHash('sha256').update(ua || 'unknown').digest('hex').slice(0, 32);
}

export async function assessRisk(input: RiskInput): Promise<RiskAssessment> {
  const reasons: string[] = [];
  let score = 0;

  // 1) Keakraban IP + perangkat dari sesi sukses sebelumnya
  const knownSessions = await prisma.adminSession.findMany({
    where: { userId: input.userId },
    select: { ip: true, userAgent: true },
    take: 100,
    orderBy: { createdAt: 'desc' },
  });
  const knownIps = new Set(knownSessions.map((s) => s.ip));
  const knownDevices = new Set(knownSessions.map((s) => deviceHash(s.userAgent)));

  const ipKnown = knownIps.has(input.ip);
  const devKnown = knownDevices.has(deviceHash(input.userAgent));

  if (knownSessions.length > 0 && !ipKnown) { score += 1; reasons.push('IP baru'); }
  if (knownSessions.length > 0 && !devKnown) { score += 1; reasons.push('Perangkat baru'); }
  if (knownSessions.length === 0) { reasons.push('Sesi pertama'); }

  // 2) Percobaan gagal akun terbaru (window singkat)
  const sinceFailWindow = new Date(Date.now() - 15 * 60 * 1000);
  const recentFails = await prisma.auditLog.count({
    where: {
      userId: input.userId,
      action: { in: ['SUPERADMIN_LOGIN_FAILED', 'SUPERADMIN_MFA_FAILED', 'SUPERADMIN_STEP_UP_FAILED'] },
      createdAt: { gte: sinceFailWindow },
    },
  }).catch(() => 0);
  if (recentFails >= 3) { score += 1; reasons.push(`${recentFails} percobaan gagal dalam 15 menit`); }
  else if (recentFails > 0) { score += 0.5; reasons.push('Ada percobaan gagal baru-baru ini'); }

  // 3) Jam tidak wajar (00:00–05:00 zona server)
  const hour = new Date().getHours();
  if (hour < 5) { score += 1; reasons.push('Login pada jam tidak wajar'); }

  let level: RiskLevel = 'LOW';
  if (score >= 3.5) level = 'HIGH';
  else if (score >= 1.5) level = 'MEDIUM';

  return { level, reasons };
}
