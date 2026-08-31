-- Tenant scoping for DeliveryAssignment and GpsLog.
-- Both models previously relied on explicit per-route where filters; adding a
-- tenantId column lets the shared prisma tenant extension (TENANT_SCOPED) enforce
-- isolation automatically. Backfill existing rows from their owning shipment/driver.

ALTER TABLE "DeliveryAssignment" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "GpsLog" ADD COLUMN "tenantId" TEXT;

-- Backfill existing rows
UPDATE "DeliveryAssignment" d
SET "tenantId" = s."tenantId"
FROM "Shipment" s
WHERE d."shipmentId" = s.id;

UPDATE "GpsLog" g
SET "tenantId" = dr."tenantId"
FROM "Driver" dr
WHERE g."driverId" = dr.id;

CREATE INDEX "DeliveryAssignment_tenantId_idx" ON "DeliveryAssignment"("tenantId");
CREATE INDEX "GpsLog_tenantId_createdAt_idx" ON "GpsLog"("tenantId", "createdAt");

ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GpsLog" ADD CONSTRAINT "GpsLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
