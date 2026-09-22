-- This is a follow-up to the original 20260916120000 migration.
-- The original migration remains immutable because Prisma records its checksum.
--
-- When this migration is reached on a database that still has the legacy tables,
-- rename them in place so their rows survive. Databases where the original DROP
-- migration already ran cannot have deleted rows recovered by SQL.
DO $$
BEGIN
  IF to_regclass('public."SalesAgent"') IS NOT NULL
     AND to_regclass('public."DeliveryPartner"') IS NULL THEN
    ALTER TABLE "SalesAgent" RENAME TO "DeliveryPartner";
  END IF;

  IF to_regclass('public."SalesAgentApplication"') IS NOT NULL
     AND to_regclass('public."DeliveryPartnerApplication"') IS NULL THEN
    ALTER TABLE "SalesAgentApplication" RENAME TO "DeliveryPartnerApplication";
  END IF;

  IF to_regclass('public."SalesAgentReferral"') IS NOT NULL
     AND to_regclass('public."DeliveryPartnerReferral"') IS NULL THEN
    ALTER TABLE "SalesAgentReferral" RENAME TO "DeliveryPartnerReferral";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'salesagentstatus')
     AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deliverypartnerstatus') THEN
    ALTER TYPE "SalesAgentStatus" RENAME TO "DeliveryPartnerStatus";
  END IF;
END $$;
