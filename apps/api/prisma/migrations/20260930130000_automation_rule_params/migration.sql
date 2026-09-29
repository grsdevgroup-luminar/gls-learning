ALTER TABLE "AutomationRule" ADD COLUMN "params" JSONB NOT NULL DEFAULT '{}';

UPDATE "AutomationRule"
SET "params" = '{"inactiveDays": 8}'
WHERE "trigger" = 'IDLE';

UPDATE "AutomationRule"
SET "params" = '{"enrolledDays": 21, "maxProgressPct": 10}'
WHERE "trigger" = 'LOW_PROGRESS';

UPDATE "AutomationRule"
SET "params" = '{"pendingHours": 4.5}'
WHERE "trigger" = 'ABANDONED_CART';

UPDATE "AutomationRule"
SET "params" = '{"minProgressPct": 85}'
WHERE "trigger" = 'ALMOST_DONE';

UPDATE "AutomationRule"
SET "params" = '{"lookbackDays": 7}'
WHERE "trigger" = 'NEW_CONTENT';

UPDATE "AutomationRule"
SET "condition" = 'No activity for more than 8 days'
WHERE "trigger" = 'IDLE';

UPDATE "AutomationRule"
SET "condition" = 'Enrolled for more than 21 days, progress at most 10%'
WHERE "trigger" = 'LOW_PROGRESS';

UPDATE "AutomationRule"
SET "condition" = 'Order pending for more than 4.5 hours'
WHERE "trigger" = 'ABANDONED_CART';

UPDATE "AutomationRule"
SET "condition" = 'Progress at least 85%'
WHERE "trigger" = 'ALMOST_DONE';

UPDATE "AutomationRule"
SET "condition" = 'Lessons added within the last 7 days, after the learner''s last activity'
WHERE "trigger" = 'NEW_CONTENT';
