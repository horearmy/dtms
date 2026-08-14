-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "returnedAt" TIMESTAMP(3),
ADD COLUMN     "returning" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "returnedAt" TIMESTAMP(3),
ADD COLUMN     "returning" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DailyReport" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "rescheduledCount" INTEGER NOT NULL DEFAULT 0,
    "fuelLiter" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyReport_reportDate_idx" ON "DailyReport"("reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_driverId_reportDate_key" ON "DailyReport"("driverId", "reportDate");

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
