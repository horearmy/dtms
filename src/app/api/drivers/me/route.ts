import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'DRIVER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const driver = await prisma.driver.findFirst({
    where: { userId: session.id },
    select: {
      name: true,
      employeeId: true,
      phone: true,
      status: true,
      tenantId: true,
    },
  });

  if (!driver) {
    return NextResponse.json({ error: 'Driver tidak ditemukan' }, { status: 404 });
  }

  return NextResponse.json(driver);
}
