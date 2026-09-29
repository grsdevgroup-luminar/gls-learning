-- Raise the minimum cooldown to 24 hours (one reminder per learner per day at most).
UPDATE "AutomationRule"
SET "cooldownHours" = 24
WHERE "cooldownHours" < 24;

ALTER TABLE "AutomationRule" DROP CONSTRAINT "AutomationRule_cooldownHours_range";

ALTER TABLE "AutomationRule"
  ADD CONSTRAINT "AutomationRule_cooldownHours_range"
  CHECK ("cooldownHours" BETWEEN 24 AND 8760);
