-- Dedupe invoice lama: simpan yang terbaru per subscription+bulan
DELETE FROM "Invoice" WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY "subscriptionId", DATE_TRUNC('month', "billingPeriodStart")
      ORDER BY "createdAt" DESC
    ) rn FROM "Invoice"
  ) t WHERE rn > 1
);
-- Backfill periodKey dari billingPeriodStart
UPDATE "Invoice" SET "periodKey" = TO_CHAR("billingPeriodStart", 'YYYY-MM') WHERE "periodKey" = '';
UPDATE "Invoice" SET "issuedAt" = "createdAt" WHERE "status" <> 'DRAFT' AND "issuedAt" IS NULL;
