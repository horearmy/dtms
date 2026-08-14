-- CreateTable
CREATE TABLE "VehicleMaintenance" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "cost" DOUBLE PRECISION,
    "odometerKm" DOUBLE PRECISION,
    "notes" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleMaintenance_vehicleId_performedAt_idx" ON "VehicleMaintenance"("vehicleId", "performedAt");

-- AddForeignKey
ALTER TABLE "VehicleMaintenance" ADD CONSTRAINT "VehicleMaintenance_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
