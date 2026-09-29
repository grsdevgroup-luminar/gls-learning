"use client";

import { useCourse, useLearningCourse } from "@/lib/api/hooks";
import { useSession } from "@/lib/api/session";
import { getApiErrorMessage } from "@/lib/api/errors";
import { LearnClient } from "./learn-client";

export function LearnLoader({ slug }: { slug: string }) {
  // Fetch the detail directly: the store's catalog list only carries summaries,
  // whose `sections` are always empty, and the player needs the curriculum.
  const { data, isLoading, isError } = useCourse(slug);
  const { user, isLoading: sessionLoading } = useSession();
  const {
    data: learningCourse,
    isLoading: learningLoading,
    isError: learningError,
    error: learningErrorObj,
  } = useLearningCourse(data?.id, !!user && !!data);

  if (isLoading || sessionLoading || (user && learningLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading course…
      </div>
    );
  }

  // A course with no lessons would crash the player, so treat it as unavailable.
  if (
    isError ||
    learningError ||
    !data ||
    (user ? !learningCourse : false) ||
    (data.sections?.every((s) => s.lessons?.length === 0) ?? false)
  ) {
    // A revoked/suspended membership surfaces its own message from the API
    // (see EnrollmentService.resolveCourseAccessBlock); everything else falls
    // back to the generic message below.
    const revokedMessage = learningError ? getApiErrorMessage(learningErrorObj) : null;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-xl font-semibold">Course not available</h1>
        <p className="text-muted-foreground">
          {revokedMessage && /revoked|suspended/i.test(revokedMessage)
            ? revokedMessage
            : "This course has no lessons yet, or is no longer available."}
        </p>
      </div>
    );
  }

  return <LearnClient course={learningCourse ?? data} />;
}
