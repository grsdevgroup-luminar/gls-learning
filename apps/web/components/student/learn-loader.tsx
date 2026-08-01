"use client";

import { useCourse } from "@/lib/api/hooks";
import { toLegacyCourseDetail } from "@/lib/api/adapters";
import { LearnClient } from "@/components/student/learn-client";

export function LearnLoader({ slug }: { slug: string }) {
  // Fetch the detail directly: the store's catalog list only carries summaries,
  // whose `sections` are always empty, and the player needs the curriculum.
  const { data, isLoading, isError } = useCourse(slug);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading course…
      </div>
    );
  }

  // A course with no lessons would crash the player, so treat it as unavailable.
  if (isError || !data || data.sections.every((s) => s.lessons.length === 0)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-xl font-semibold">Course not available</h1>
        <p className="text-muted-foreground">
          This course has no lessons yet, or is no longer available.
        </p>
      </div>
    );
  }

  return <LearnClient course={toLegacyCourseDetail(data)} />;
}
