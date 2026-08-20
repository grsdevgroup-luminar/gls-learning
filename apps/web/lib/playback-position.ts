/**
 * Per-lesson video resume points, kept in localStorage so a refresh (or a
 * lesson switch and back) drops the learner where they left off without a
 * round-trip. Browser-local by design: no cross-device sync, and it works for
 * logged-out visitors on preview lessons.
 */

const KEY_PREFIX = "skillstream_pos_v1:";

/** Entries older than this are dropped on read, so the store can't grow
 *  unbounded as a learner moves through a large catalog. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Below this, resuming is more annoying than starting over. */
const MIN_RESUME_SEC = 5;

/** Treated as "finished" — resuming here would land on the end card. */
const END_MARGIN_SEC = 10;
const END_RATIO = 0.95;

interface Stored {
  sec: number;
  at: number;
}

function key(lessonId: string) {
  return KEY_PREFIX + lessonId;
}

/** The saved position in whole seconds, or 0 when there's nothing worth resuming. */
export function readPosition(lessonId: string): number {
  try {
    const raw = localStorage.getItem(key(lessonId));
    if (!raw) return 0;

    const stored = JSON.parse(raw) as Partial<Stored> | null;
    if (!stored || !Number.isFinite(stored.sec) || !Number.isFinite(stored.at)) {
      return 0;
    }
    if (Date.now() - stored.at! > MAX_AGE_MS) {
      clearPosition(lessonId);
      return 0;
    }
    return stored.sec! >= MIN_RESUME_SEC ? Math.floor(stored.sec!) : 0;
  } catch {
    return 0;
  }
}

/** Saves the position, or clears it when the lesson is effectively finished. */
export function writePosition(lessonId: string, sec: number, durationSec: number) {
  if (!Number.isFinite(sec) || !Number.isFinite(durationSec) || durationSec <= 0) {
    return;
  }
  const finished = sec >= durationSec - END_MARGIN_SEC || sec / durationSec > END_RATIO;
  if (sec < MIN_RESUME_SEC || finished) {
    clearPosition(lessonId);
    return;
  }
  try {
    const stored: Stored = { sec: Math.floor(sec), at: Date.now() };
    localStorage.setItem(key(lessonId), JSON.stringify(stored));
  } catch {
    /* quota or private-mode — resume is best-effort */
  }
}

export function clearPosition(lessonId: string) {
  try {
    localStorage.removeItem(key(lessonId));
  } catch {
    /* ignore */
  }
}
