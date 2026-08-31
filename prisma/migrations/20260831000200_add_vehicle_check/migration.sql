-- CreateTable
CREATE TABLE "VehicleCheck" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "answers" JSONB NOT NULL,
    "issues" TEXT[],
    "hasIssue" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleCheck_vehicleId_checkedAt_idx" ON "VehicleCheck"("vehicleId", "checkedAt");

-- CreateIndex
CREATE INDEX "VehicleCheck_driverId_idx" ON "VehicleCheck"("driverId");

-- CreateIndex
CREATE INDEX "VehicleCheck_warehouseId_idx" ON "VehicleCheck"("warehouseId");

-- CreateIndex
CREATE INDEX "VehicleCheck_shipmentId_idx" ON "VehicleCheck"("shipmentId");

-- AddForeignKey
ALTER TABLE "VehicleCheck" ADD CONSTRAINT "VehicleCheck_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCheck" ADD CONSTRAINT "VehicleCheck_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCheck" ADD CONSTRAINT "VehicleCheck_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCheck" ADD CONSTRAINT "VehicleCheck_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;