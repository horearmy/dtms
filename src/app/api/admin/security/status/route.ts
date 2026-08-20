import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';

export async function GET() {
  const { session, error } = await guardPermission('*');
  if (error) return error;

  return runWithTenant(null, async () => {
    const now = new Date();
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [failedLogins24h, lockedOutUsers, lockedOutIPs, users2faEligibleNo2fa, totalUsersOnEligiblePlans, usersMustChangePassword] =
      await Promise.all([
        prisma.loginAttempt.count({ where: { success: false, createdAt: { gte: h24 } } }),

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
      ]);

    const failedPct = Math.min(100, (failedLogins24h / 60) * 100);
    const lockedUsersPct = Math.min(100, (lockedOutUsers / 2) * 100);
    const lockedIPsPct = Math.min(100, (lockedOutIPs / 1) * 100);
    const fa2Eligible = totalUsersOnEligiblePlans > 0;
    const fa2Pct = fa2Eligible ? ((users2faEligibleNo2fa / totalUsersOnEligiblePlans) * 100) : 0;
    const mustChangePct = Math.min(100, (usersMustChangePassword / 3) * 100);

    const score = Math.min(100, Math.max(0, Math.round(
      failedPct * 0.30 + lockedUsersPct * 0.25 + lockedIPsPct * 0.20 + fa2Pct * 0.15 + mustChangePct * 0.10
    )));

    const level = score > 60 ? 'HIGH' : score > 30 ? 'MEDIUM' : 'LOW';

    return NextResponse.json({ score, level });
  });
}
