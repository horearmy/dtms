import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp, checkRateLimit } from '@/lib/security';

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await checkRateLimit(`tenants:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Terlalu banyak request, coba lagi nanti' }, { status: 429 });
  }

  const tenants = await prisma.tenant.findMany({
    where: { active: true },
    select: { id: true, name: true, slug: true, primaryColor: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(tenants);
}
