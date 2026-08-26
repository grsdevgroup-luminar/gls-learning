-- Repurposes the never-populated `minutesWatched` counter into a real,
-- actively-written watch-time accumulator, stored in seconds (matching
-- durationSec elsewhere in the schema) for precision.
ALTER TABLE "Enrollment" RENAME COLUMN "minutesWatched" TO "watchTimeSec";
