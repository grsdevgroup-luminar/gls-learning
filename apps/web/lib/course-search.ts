import {
  MAX_COURSE_SEARCH_LENGTH,
  activeCourseSearchQuery,
  compactCourseSearchQuery,
  normalizeCourseSearchQuery,
} from "@skillstream/shared";
import { toast } from "sonner";

export {
  MAX_COURSE_SEARCH_LENGTH,
  activeCourseSearchQuery,
  compactCourseSearchQuery,
  normalizeCourseSearchQuery,
};

/**
 * Keep local input when a tracked debounced URL push lands but the user has
 * already typed ahead (or below min-length while the URL was cleared).
 * Only call with the exact `pendingUrlQ` value that was just pushed.
 */
export function shouldPreserveSearchInputOverUrlSync(
  current: string,
  urlQ: string,
  pendingUrlQ: string,
): boolean {
  const trimmed = current.trim();
  if (trimmed === pendingUrlQ) return false;
  if (pendingUrlQ === "") return trimmed.length > 0;
  return trimmed.length > pendingUrlQ.length && trimmed.startsWith(pendingUrlQ);
}

/** Clamp catalog search input and surface a one-time toast when the limit is hit. */
export function onCourseSearchInputChange(
  next: string,
  current: string,
  setValue: (value: string) => void,
): void {
  if (next.length > MAX_COURSE_SEARCH_LENGTH) {
    if (current.length < MAX_COURSE_SEARCH_LENGTH) {
      toast.error(`Search cannot exceed ${MAX_COURSE_SEARCH_LENGTH} characters`);
    }
    setValue(next.slice(0, MAX_COURSE_SEARCH_LENGTH));
    return;
  }
  setValue(next);
}
