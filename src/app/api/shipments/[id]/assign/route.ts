import { NextRequest, NextResponse } from 'next/server';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { createAssignment } from '@/lib/assignment-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.SHIPMENT.ASSIGN);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    const { driverId, vehicleId } = body || {};
    if (!driverId) return NextResponse.json({ error: 'Driver wajib dipilih' }, { status: 400 });
    if (!vehicleId) return NextResponse.json({ error: 'Kendaraan wajib dipilih' }, { status: 400 });

    const result = await createAssignment({
      shipmentId: id,
      driverId: String(driverId),
      vehicleId: String(vehicleId),
      tenantId: session?.tenantId ?? null,
      requireActiveDriver: false,
      requireShipmentAssignable: false,
      reassign: true,
      branchId: session?.branchId ?? null,
      waProceed: 'Silakan persiapkan diri untuk pengiriman.',
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    await logAudit(session, 'ASSIGN_DRIVER', 'SHIPMENT', { newData: { trackingNumber: result.assignment.shipment.trackingNumber, driverId, vehicleId: result.assignment.vehicleId } }, req);
    return NextResponse.json({ assignment: result.assignment }, { status: 201 });
  });
}
