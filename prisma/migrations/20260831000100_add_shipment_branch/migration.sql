-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "branchId" TEXT;

-- CreateIndex
CREATE INDEX "Shipment_branchId_idx" ON "Shipment"("branchId");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
