import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';

const SECURITY_ACTIONS = [
  'LOGIN_SUCCESS', 'LOGIN_FAILED',
  'TWO_FACTOR_LOGIN_SUCCESS', 'TWO_FACTOR_LOGIN_FAILED',
  'TWO_FACTOR_ENABLED', 'TWO_FACTOR_DISABLED',
  'CHANGE_PASSWORD', 'RESET_PASSWORD', 'RESET_PASSWORD_SELF',
  'CREATE_USER', 'DELETE_USER',
  'DELETE_TENANT', 'ARCHIVE_TENANT',
  'TENANT_THROTTLE_UPDATE',
];

function computeThreatScore(data: {
  failedLogins24h: number;
  lockedOutUsers: number;
  lockedOutIPs: number;
  users2faDisabledOnEligiblePlans: number;
  usersMustChangePassword: number;
  totalUsersOnEligiblePlans: number;
}) {
  const failedPct = Math.min(100, (data.failedLogins24h / 60) * 100);
  const lockedUsersPct = Math.min(100, (data.lockedOutUsers / 2) * 100);
  const lockedIPsPct = Math.min(100, (data.lockedOutIPs / 1) * 100);
  const fa2Eligible = data.totalUsersOnEligiblePlans > 0;
  const fa2Pct = fa2Eligible
    ? ((data.users2faDisabledOnEligiblePlans / data.totalUsersOnEligiblePlans) * 100)
    : 0;
  const mustChangePct = Math.min(100, (data.usersMustChangePassword / 3) * 100);

  const score = Math.round(
    failedPct * 0.30 +
    lockedUsersPct * 0.25 +
    lockedIPsPct * 0.20 +
    fa2Pct * 0.15 +
    mustChangePct * 0.10
  );

  const clampedScore = Math.min(100, Math.max(0, score));

  return {
    score: clampedScore,
    level: clampedScore > 60 ? 'HIGH' : clampedScore > 30 ? 'MEDIUM' : 'LOW',
    breakdown: {
      failedLogins: { value: data.failedLogins24h, weight: 30, pct: Math.round(failedPct) },
      lockedUsers: { value: data.lockedOutUsers, weight: 25, pct: Math.round(lockedUsersPct) },
      lockedIPs: { value: data.lockedOutIPs, weight: 20, pct: Math.round(lockedIPsPct) },
      twoFA: { value: data.users2faDisabledOnEligiblePlans, total: data.totalUsersOnEligiblePlans, weight: 15, pct: Math.round(fa2Pct) },
      mustChangePassword: { value: data.usersMustChangePassword, weight: 10, pct: Math.round(mustChangePct) },
    },
  };
}

export async function GET() {
  const { session, error } = await guardPermission('*');
  if (error) return error;

  return runWithTenant(null, async () => {
    const now = new Date();
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const h1 = new Date(now.getTime() - 60 * 60 * 1000);
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const pwd90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [
      failedLogins24h,
      successfulLogins24h,
      lockedOutUsers,
      lockedOutIPs,
      users2faEligibleNo2fa,
      totalUsersOnEligiblePlans,
      usersMustChangePassword,
      activeApiKeys,
      pendingResets,
      topAttackingIPs,
      topTargetedUsers,
      loginByHour,
      recentSecurityEvents,
      userPosture,
      totalUsers,
      totalApiKeys,
    ] = await Promise.all([
      prisma.loginAttempt.count({ where: { success: false, createdAt: { gte: h24 } } }),
      prisma.loginAttempt.count({ where: { success: true, createdAt: { gte: h24 } } }),

      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT username)::int AS count FROM "LoginAttempt"
        WHERE success = false AND "createdAt" > ${h24}
        GROUP BY username HAVING COUNT(*) >= 5
      `.then(r => Number(r[0]?.count ?? 0)),

      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT ip)::int AS count FROM "LoginAttempt"
        WHERE success = false AND "createdAt" > ${h24}
        GROUP BY ip HAVING COUNT(*) >= 10
      `.then(r => Number(r[0]?.count ?? 0)),

      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(u.id)::int AS count FROM "User" u
        INNER JOIN "Subscription" s ON s."tenantId" = u."tenantId"
        INNER JOIN "Plan" p ON p.id = s."planId"
        WHERE u.status = 'ACTIVE'
          AND u."totpEnabled" = false
          AND p.features::text LIKE '%two_factor%'
      `.then(r => Number(r[0]?.count ?? 0)),

      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT u.id)::int AS count FROM "User" u
        INNER JOIN "Subscription" s ON s."tenantId" = u."tenantId"
        INNER JOIN "Plan" p ON p.id = s."planId"
        WHERE u.status = 'ACTIVE'
          AND p.features::text LIKE '%two_factor%'
      `.then(r => Number(r[0]?.count ?? 0)),

      prisma.user.count({ where: { mustChangePassword: true, status: 'ACTIVE' } }),
      prisma.apiKey.count({ where: { active: true } }),
      prisma.passwordResetToken.count({ where: { usedAt: null, expiresAt: { gt: now } } }),

      prisma.$queryRaw<{ ip: string; count: bigint }[]>`
        SELECT ip, COUNT(*)::int AS count FROM "LoginAttempt"
        WHERE success = false AND "createdAt" > ${h24}
        GROUP BY ip ORDER BY count DESC LIMIT 10
      `,

      prisma.$queryRaw<{ username: string; count: bigint }[]>`
        SELECT username, COUNT(*)::int AS count FROM "LoginAttempt"
        WHERE success = false AND "createdAt" > ${h24}
        GROUP BY username ORDER BY count DESC LIMIT 10
      `,

      prisma.$queryRaw<{ hour: Date; failed: bigint; success: bigint }[]>`
        SELECT
          date_trunc('hour', "createdAt") AS hour,
          COUNT(*) FILTER (WHERE success = false)::int AS failed,
          COUNT(*) FILTER (WHERE success = true)::int AS success
        FROM "LoginAttempt"
        WHERE "createdAt" > ${h1}
        GROUP BY date_trunc('hour', "createdAt")
        ORDER BY hour ASC
      `,

      prisma.auditLog.findMany({
        where: { action: { in: SECURITY_ACTIONS }, createdAt: { gte: d7 } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { select: { name: true, username: true } } },
      }),

      prisma.$queryRaw<{
        tenantId: string; tenantName: string; total: bigint;
        fa2enabled: bigint; mustchange: bigint; oldpassword: bigint;
      }[]>`
        SELECT
          t.id AS "tenantId",
          t.name AS "tenantName",
          COUNT(u.id)::int AS total,
          COUNT(u.id) FILTER (WHERE u."totpEnabled" = true)::int AS "fa2enabled",
          COUNT(u.id) FILTER (WHERE u."mustChangePassword" = true)::int AS mustchange,
          COUNT(u.id) FILTER (WHERE u."lastPasswordChange" < ${pwd90} OR u."lastPasswordChange" IS NULL)::int AS oldpassword
        FROM "Tenant" t
        LEFT JOIN "User" u ON u."tenantId" = t.id AND u.status = 'ACTIVE'
        WHERE t.status != 'ARCHIVED'
        GROUP BY t.id, t.name
        ORDER BY total DESC
        LIMIT 50
      `,

      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.apiKey.count(),
    ]);

    const threat = computeThreatScore({
      failedLogins24h,
      lockedOutUsers,
      lockedOutIPs,
      users2faDisabledOnEligiblePlans: users2faEligibleNo2fa,
      usersMustChangePassword,
      totalUsersOnEligiblePlans,
    });

    return NextResponse.json({
      threatScore: threat.score,
      threatLevel: threat.level,
      threatBreakdown: threat.breakdown,
      summary: {
        failedLogins24h,
        successfulLogins24h,
        lockedOutUsers,
        lockedOutIPs,
        users2faDisabled: users2faEligibleNo2fa,
        usersMustChangePassword,
        activeApiKeys,
        pendingResets,
        totalUsers,
        totalApiKeys,
      },
      loginActivity: {
        byHour: loginByHour.map((r: { hour: Date; failed: bigint; success: bigint }) => ({
          hour: r.hour.toISOString(),
          failed: Number(r.failed),
          success: Number(r.success),
        })),
        topAttackingIPs: topAttackingIPs.map((r: { ip: string; count: bigint }) => ({
          ip: r.ip, count: Number(r.count),
        })),
        topTargetedUsers: topTargetedUsers.map((r: { username: string; count: bigint }) => ({
          username: r.username, count: Number(r.count),
        })),
      },
      recentSecurityEvents: recentSecurityEvents.map((e) => ({
        id: e.id,
        createdAt: e.createdAt.toISOString(),
        userName: e.user?.name || 'Sistem',
        action: e.action,
        module: e.module,
        ip: e.ip,
        path: e.path,
        detail: e.newData,
      })),
      userPosture: userPosture.map((r) => ({
        tenantId: r.tenantId,
        tenantName: r.tenantName,
        totalUsers: Number(r.total),
        users2faEnabled: Number(r.fa2enabled),
        usersMustChangePassword: Number(r.mustchange),
        usersOldPassword: Number(r.oldpassword),
      })),
    });
  });
}
