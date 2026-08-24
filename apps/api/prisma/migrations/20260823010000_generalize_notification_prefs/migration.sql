-- CreateTable
CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "sms" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId","event")
);

-- Backfill: unpack each StudentProfile.notificationPrefs JSON blob into one row
-- per (userId, trigger) for the 5 known reminder triggers, before the column
-- is dropped below. A trigger missing from the JSON keeps the same defaults
-- (email true, sms false) that resolveNotificationPrefs() has always applied,
-- so this is a lossless move, not a behavior change.
INSERT INTO "NotificationPreference" ("userId", "event", "inApp", "email", "sms")
SELECT
  sp."userId",
  trig.event,
  true,
  COALESCE((sp."notificationPrefs" -> trig.event ->> 'email')::boolean, true),
  COALESCE((sp."notificationPrefs" -> trig.event ->> 'sms')::boolean, false)
FROM "StudentProfile" sp
CROSS JOIN (VALUES ('IDLE'), ('LOW_PROGRESS'), ('ABANDONED_CART'), ('ALMOST_DONE'), ('NEW_CONTENT')) AS trig(event)
WHERE sp."notificationPrefs" IS NOT NULL
ON CONFLICT ("userId", "event") DO NOTHING;

-- AlterTable
ALTER TABLE "StudentProfile" DROP COLUMN "notificationPrefs";

-- AlterTable: widen from the ReminderTrigger enum to plain text so this log
-- can also record the 9 NotificationEvent values (Phase 1 transactional
-- events), not just the 5 original reminder triggers.
ALTER TABLE "ReminderLog" ALTER COLUMN "trigger" TYPE TEXT USING ("trigger"::text);
