import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, runWithTenant } from '@/lib/api-guard';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  const { session, error } = await guard('DRIVER', 'SUPER_ADMIN', 'DISPATCHER', 'ADMIN_OPERASIONAL', 'SUPERVISOR');
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const driver = await prisma.driver.findUnique({ where: { userId: session!.id } });
    const assignment = await prisma.deliveryAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        shipment: {
          include: {
            sender: true,
            receiver: true,
            items: true,
            events: { orderBy: { createdAt: 'asc' } },
            pods: true,
          },
        },
        vehicle: true,
      },
    });

    if (!assignment) return NextResponse.json({ error: 'Tugas tidak ditemukan' }, { status: 404 });

    if (session!.role === 'DRIVER' && driver && assignment.driverId !== driver.id) {
      return NextResponse.json({ error: 'Bukan tugas Anda' }, { status: 403 });
    }

    return NextResponse.json({ assignment });
  });
}