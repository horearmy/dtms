ALTER TABLE "GpsLog" ADD COLUMN "ingestKey" TEXT;

CREATE UNIQUE INDEX "GpsLog_ingestKey_key" ON "GpsLog"("ingestKey");
