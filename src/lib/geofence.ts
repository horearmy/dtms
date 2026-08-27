import { prisma } from './prisma';
import { haversineKm } from './eta';
import { isPointInPolygon, parsePoints } from './geofence-polygon';

function isInsideGeofence(latitude: number, longitude: number, g: any): boolean {
  const shape = (g.shape as string) || 'CIRCLE';
  if (shape === 'POLYGON') {
    const pts = parsePoints((g as any).points);
    if (!pts || pts.length < 3) return false;
    return isPointInPolygon({ lat: latitude, lng: longitude }, pts);
  }
  const dist = haversineKm(latitude, longitude, g.latitude, g.longitude);
  const radiusKm = (g.radiusMeters as number) / 1000;
  return dist <= radiusKm;
}

export async function checkGeofences(driverId: string, latitude: number, longitude: number, shipmentId?: string) {
  const geofences = await prisma.geofence.findMany({ where: { active: true } });
  const created: { geofence: string; type: string }[] = [];
  const driver = await prisma.driver.findUnique({ where: { id: driverId }, include: { user: true } });
  if (!driver) return created;

  for (const g of geofences) {
    const inside = isInsideGeofence(latitude, longitude, g);

    const last = await prisma.geofenceEvent.findFirst({
      where: { geofenceId: g.id, driverId },
      orderBy: { createdAt: 'desc' },
    });

    if (inside && (!last || last.eventType === 'EXIT')) {
      await prisma.geofenceEvent.create({
        data: {
          geofenceId: g.id,
          driverId,
          shipmentId: shipmentId || null,
          eventType: 'ENTER',
          latitude,
          longitude,
        },
      });
      const radiusLabel = (g.shape as string) === 'POLYGON' ? 'polygon' : `${g.radiusMeters} m`;
      await prisma.notification.create({
        data: {
          message: `Driver masuk area: ${g.name} — ${driver.name} masuk perimeter ${g.name} (${radiusLabel}).`,
          userId: driver.userId,
        },
      });
      created.push({ geofence: g.name, type: 'ENTER' });
    } else if (!inside && last && last.eventType === 'ENTER') {
      await prisma.geofenceEvent.create({
        data: {
          geofenceId: g.id,
          driverId,
          shipmentId: shipmentId || null,
          eventType: 'EXIT',
          latitude,
          longitude,
        },
      });
      created.push({ geofence: g.name, type: 'EXIT' });
    }
  }

  return created;
}