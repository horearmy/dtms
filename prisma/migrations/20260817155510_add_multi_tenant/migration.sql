-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Geofence" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "tenantId" TEXT;

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#2563eb',
    "secondaryColor" TEXT NOT NULL DEFAULT '#1e40af',
    "accentColor" TEXT NOT NULL DEFAULT '#3b82f6',
    "domain" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "maxDrivers" INTEGER NOT NULL DEFAULT 10,
    "maxShipments" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_domain_key" ON "Tenant"("domain");

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_domain_idx" ON "Tenant"("domain");

-- CreateIndex
CREATE INDEX "DemoRequest_status_idx" ON "DemoRequest"("status");

-- CreateIndex
CREATE INDEX "DemoRequest_createdAt_idx" ON "DemoRequest"("createdAt");

-- CreateIndex
CREATE INDEX "Customer_tenantId_idx" ON "Customer"("tenantId");

-- CreateIndex
CREATE INDEX "Driver_tenantId_idx" ON "Driver"("tenantId");

-- CreateIndex
CREATE INDEX "Geofence_tenantId_idx" ON "Geofence"("tenantId");

-- CreateIndex
CREATE INDEX "Shipment_tenantId_idx" ON "Shipment"("tenantId");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "Vehicle_tenantId_idx" ON "Vehicle"("tenantId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Geofence" ADD CONSTRAINT "Geofence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
