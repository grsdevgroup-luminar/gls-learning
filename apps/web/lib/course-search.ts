import {
  MAX_COURSE_SEARCH_LENGTH,
  activeCourseSearchQuery,
  normalizeCourseSearchQuery,
} from "@skillstream/shared";
import { toast } from "sonner";

export { MAX_COURSE_SEARCH_LENGTH, activeCourseSearchQuery, normalizeCourseSearchQuery };

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
