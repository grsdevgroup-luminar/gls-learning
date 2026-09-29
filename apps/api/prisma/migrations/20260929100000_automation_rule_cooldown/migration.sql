ALTER TABLE "AutomationRule"
  ADD COLUMN "cooldownHours" INTEGER NOT NULL DEFAULT 168;

-- Preserve the old trigger-based behavior for every existing rule.
UPDATE "AutomationRule"
SET "cooldownHours" = 24
WHERE "trigger" = 'ABANDONED_CART';

ALTER TABLE "AutomationRule"
  ADD CONSTRAINT "AutomationRule_cooldownHours_range"
  CHECK ("cooldownHours" BETWEEN 1 AND 8760);
