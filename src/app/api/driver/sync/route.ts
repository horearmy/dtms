// src/app/api/driver/sync/route.ts
// Offline driver sync endpoint — accepts batched offline actions for server commit.
import { NextRequest, NextResponse } from 'next/server';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { ingestGps } from '@/lib/gps-processor';
import { ShipmentStatus } from '@prisma/client';

const DRIVER_FLOW: Record<string, string[]> = {
  DISPATCHED: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['ARRIVED_AT_HUB', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  ARRIVED_AT_HUB: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED', 'CANCELLED'],
};

interface OfflineAction {
  localEventId: string;
  deviceId: string;
  type: string; // GPS_POINT | POD | STATUS_UPDATE | INCIDENT | CHECKLIST
  occurredAt: string;
  payload: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.GPS.SEND);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    const actions: OfflineAction[] = Array.isArray(body.actions) ? body.actions : [];
    const driverId = body.driverId as string | undefined;

    if (!driverId || actions.length === 0) {
      return NextResponse.json({ error: 'driverId and actions[] required' }, { status: 400 });
    }

    const results: { localEventId: string; status: string; serverEventId?: string; error?: string }[] = [];

    for (const action of actions.slice(0, 200)) {
      try {
        switch (action.type) {
          case 'GPS_POINT': {
            const p = action.payload;
            ingestGps({
              tenantId: session?.tenantId ?? undefined,
              driverId,
              vehicleId: p.vehicleId as string | undefined,
              shipmentId: p.shipmentId as string | undefined,
              latitude: p.latitude as number,
              longitude: p.longitude as number,
              speed: p.speed as number | undefined,
              heading: p.heading as number | undefined,
              accuracy: p.accuracy as number | undefined,
              battery: p.battery as number | undefined,
            }, session?.id);
            results.push({ localEventId: action.localEventId, status: 'accepted' });
            break;
          }
          case 'POD': {
            const p = action.payload;
            const pod = await prisma.proofOfDelivery.upsert({
              where: { shipmentId: p.shipmentId as string },
              update: {
                receiverName: p.receiverName as string,
                signature: p.signature as string | undefined,
                photo: p.photo as string | undefined,
                latitude: p.latitude as number | undefined,
                longitude: p.longitude as number | undefined,
                notes: p.notes as string | undefined,
                deliveredAt: new Date(action.occurredAt),
              },
              create: {
                shipmentId: p.shipmentId as string,
                receiverName: p.receiverName as string,
                signature: p.signature as string | undefined,
                photo: p.photo as string | undefined,
                latitude: p.latitude as number | undefined,
                longitude: p.longitude as number | undefined,
                notes: p.notes as string | undefined,
                deliveredAt: new Date(action.occurredAt),
              },
            });
            results.push({ localEventId: action.localEventId, status: 'committed', serverEventId: pod.id });
            break;
          }
          case 'STATUS_UPDATE': {
            const p = action.payload;
            if (p.shipmentId && p.status) {
              const newStatus = p.status as string;
              const allowedNext = DRIVER_FLOW[newStatus];
              if (!allowedNext) {
                results.push({ localEventId: action.localEventId, status: 'error', error: `Status ${newStatus} tidak valid` });
                break;
              }
              const shipment = await prisma.shipment.findUnique({
                where: { id: p.shipmentId as string },
                select: { status: true },
              });
              if (!shipment) {
                results.push({ localEventId: action.localEventId, status: 'error', error: 'Shipment tidak ditemukan' });
                break;
              }
              if (!allowedNext.includes(shipment.status)) {
                results.push({ localEventId: action.localEventId, status: 'error', error: `Tidak dapatubah dari ${shipment.status} ke ${newStatus}` });
                break;
              }
              const assignment = await prisma.deliveryAssignment.findFirst({
                where: { shipmentId: p.shipmentId as string, driverId },
              });
              if (!assignment) {
                results.push({ localEventId: action.localEventId, status: 'error', error: 'Shipment bukan tugas Anda' });
                break;
              }
              await prisma.shipment.update({
                where: { id: p.shipmentId as string },
                data: { status: newStatus as ShipmentStatus },
              });
            }
            results.push({ localEventId: action.localEventId, status: 'committed' });
            break;
          }
          default:
            results.push({ localEventId: action.localEventId, status: 'skipped', error: `Unknown type: ${action.type}` });
        }
      } catch (err: unknown) {
        results.push({
          localEventId: action.localEventId,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({ synced: results.length, results });
  });
}
