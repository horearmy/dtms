-- CreateTable
CREATE TABLE "WarehouseScan" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scannedBy" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WarehouseScan_shipmentId_idx" ON "WarehouseScan"("shipmentId");

-- AddForeignKey
ALTER TABLE "WarehouseScan" ADD CONSTRAINT "WarehouseScan_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
