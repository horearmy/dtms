ALTER TABLE "AuditLog" ADD COLUMN "legalHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GpsLog" ADD COLUMN "legalHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Message" ADD COLUMN "legalHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Notification" ADD COLUMN "legalHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShipmentEvent" ADD COLUMN "legalHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UploadedFile" ADD COLUMN "legalHold" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "GpsLog_createdAt_legalHold_idx" ON "GpsLog"("createdAt", "legalHold");
CREATE INDEX "AuditLog_createdAt_legalHold_idx" ON "AuditLog"("createdAt", "legalHold");
CREATE INDEX "Message_createdAt_legalHold_idx" ON "Message"("createdAt", "legalHold");
CREATE INDEX "Notification_createdAt_legalHold_idx" ON "Notification"("createdAt", "legalHold");
CREATE INDEX "ShipmentEvent_createdAt_legalHold_idx" ON "ShipmentEvent"("createdAt", "legalHold");
CREATE INDEX "UploadedFile_createdAt_legalHold_idx" ON "UploadedFile"("createdAt", "legalHold");
