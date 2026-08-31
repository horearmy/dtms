import { ShipmentStatus } from '@prisma/client';
import { prisma } from './prisma';
import { isWhatsAppEnabled, sendTextMessage } from './whatsapp';

export const ASSIGNABLE_SHIPMENT_STATUSES: readonly ShipmentStatus[] = [
  'WAREHOUSE_RECEIVED', 'SORTING', 'ORDER_CREATED',
];

// Status yang menutup sebuah trip (driver/kendaraan bebas ditugaskan lagi).
export const CLOSED_STATUSES: readonly ShipmentStatus[] = [
  'DELIVERED', 'RETURNED', 'DELIVERY_FAILED',
];

// Status yang berarti trip masih "terbuka" — driver/kendaraan tidak boleh
// ditugaskan ke shipment lain, agar tidak terjadi double-booking di hari yang sama.
export const OPEN_STATUSES: readonly ShipmentStatus[] = [
  'ORDER_CREATED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'WAREHOUSE_RECEIVED', 'SORTING',
  'DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_HUB', 'OUT_FOR_DELIVERY', 'RESCHEDULED', 'RETURN_TO_SENDER',
];

type AssignmentRecord = {
  id: string;
  shipmentId: string;
  driverId: string;
  vehicleId: string;
  shipment: { id: string; trackingNumber: string; destination: string };
  driver: { name: string; phone: string | null };
  vehicle: { vehicleNumber: string } | null;
};

export type AssignmentResult =
  | { ok: true; assignment: AssignmentRecord }
  | { ok: false; status: number; error: string };

export type CreateAssignmentOptions = {
  shipmentId: string;
  driverId: string;
  vehicleId: string;
  // Pemanggil boleh menegaskan pembeda:
  tenantId?: string | null;        // tenant yang memiliki assignment (isolasi)
  requireActiveDriver?: boolean;   // dispatch board mewajibkan driver ACTIVE
  requireShipmentAssignable?: boolean; // dispatch board: status harus bisa ditugaskan
  reassign?: boolean;              // assign ulang (hapus assignment lama)
  branchId?: string | null;        // isolasi branch: tolak bila shipment punya branch berbeda
  waProceed?: string;              // kalimat lanjutan di pesan WhatsApp ke driver
};

export async function createAssignment(opts: CreateAssignmentOptions): Promise<AssignmentResult> {
  const { shipmentId, driverId, vehicleId } = opts;

  if (!shipmentId || !driverId || !vehicleId) {
    return { ok: false, error: 'shipmentId, driverId, dan vehicleId wajib diisi', status: 400 };
  }

  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId }, include: { assignments: true } });
  if (!shipment) return { ok: false, error: 'Shipment tidak ditemukan', status: 404 };

  if (opts.branchId && shipment.branchId && shipment.branchId !== opts.branchId) {
    return { ok: false, error: 'Shipment ini di luar scope cabang Anda', status: 403 };
  }

  if ((opts.requireShipmentAssignable ?? true) && !(ASSIGNABLE_SHIPMENT_STATUSES as readonly string[]).includes(shipment.status as never)) {
    return { ok: false, error: `Shipment dengan status ${shipment.status} tidak dapat ditugaskan`, status: 400 };
  }

  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) return { ok: false, error: 'Driver tidak ditemukan', status: 404 };
  if (opts.requireActiveDriver && driver.status !== 'ACTIVE') {
    return { ok: false, error: `Driver ${driver.name} tidak berstatus AKTIF`, status: 400 };
  }
  if (driver.returning) {
    return { ok: false, error: `Driver ${driver.name} sedang kembali ke gudang. Pilih driver lain.`, status: 400 };
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return { ok: false, error: 'Kendaraan tidak ditemukan', status: 404 };
  if (vehicle.status === 'MAINTENANCE') {
    return { ok: false, error: `Kendaraan ${vehicle.vehicleNumber} sedang MAINTENANCE dan tidak dapat digunakan`, status: 400 };
  }
  if (vehicle.returning) {
    return { ok: false, error: `Kendaraan ${vehicle.vehicleNumber} sedang kembali ke gudang. Pilih kendaraan lain.`, status: 400 };
  }

  const [driverOpenTrip, vehicleOpenTrip, existing] = await Promise.all([
    prisma.deliveryAssignment.findFirst({
      where: {
        driverId,
        shipmentId: { not: shipmentId },
        shipment: { status: { in: OPEN_STATUSES as ShipmentStatus[] } },
      },
      select: { shipment: { select: { trackingNumber: true } } },
    }),
    prisma.deliveryAssignment.findFirst({
      where: {
        vehicleId,
        shipmentId: { not: shipmentId },
        shipment: { status: { in: OPEN_STATUSES as ShipmentStatus[] } },
      },
      select: { shipment: { select: { trackingNumber: true } } },
    }),
    prisma.deliveryAssignment.findFirst({ where: { shipmentId, driverId } }),
  ]);
  if (driverOpenTrip) {
    return {
      ok: false,
      error: `Driver ${driver.name} masih punya pengiriman terbuka (resi ${driverOpenTrip.shipment.trackingNumber}) dan belum selesai. Pilih driver lain.`,
      status: 400,
    };
  }
  if (vehicleOpenTrip) {
    return {
      ok: false,
      error: `Kendaraan ${vehicle.vehicleNumber} masih dipakai resi ${vehicleOpenTrip.shipment.trackingNumber} (belum selesai). Pilih kendaraan lain.`,
      status: 400,
    };
  }
  if (!opts.reassign && existing) {
    return { ok: false, error: 'Shipment sudah ditugaskan ke driver ini', status: 409 };
  }

  const assignment = await prisma.$transaction(async (tx) => {
    if (opts.reassign) {
      await tx.deliveryAssignment.deleteMany({ where: { shipmentId } });
    }
    // Trip baru dimulai: bersihkan sisa flag "kembali ke gudang" dari perjalanan
    // sebelumnya agar aplikasi driver tidak terlihat sudah tiba di gudang
    // sebelum driver benar-benar menekan tombol kembali.
    await tx.driver.update({
      where: { id: driverId },
      data: { returning: false, returnedAt: null, returnStartedAt: null },
    });
    await tx.vehicle.update({
      where: { id: vehicleId },
      data: { returning: false, returnedAt: null },
    });
    return tx.deliveryAssignment.create({
      data: { shipmentId, driverId, vehicleId, tenantId: opts.tenantId ?? null },
      include: {
        shipment: { select: { id: true, trackingNumber: true, destination: true } },
        driver: { select: { name: true, phone: true } },
        vehicle: { select: { vehicleNumber: true } },
      },
    });
  });

  if (opts.waProceed) {
    try {
      const text =
        `Anda ditugaskan untuk pengiriman resi *${assignment.shipment.trackingNumber}*\n` +
        `Tujuan: ${assignment.shipment.destination}\n\n` +
        `${opts.waProceed}`;
      if (driver.phone && isWhatsAppEnabled()) await sendTextMessage(driver.phone, text);
    } catch {
      // WhatsApp bersifat non-kritikal
    }
  }

  return { ok: true, assignment: assignment as AssignmentRecord };
}
