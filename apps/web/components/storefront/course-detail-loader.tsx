"use client";

import { useCourse } from "@/lib/api/hooks";
import { toLegacyCourseDetail } from "@/lib/api/adapters";
import { CourseDetail } from "@/components/storefront/course-detail";
import { Skeleton } from "@/components/ui/skeleton";

export function CourseDetailLoader({ slug }: { slug: string }) {
  // Fetch the detail directly: the store's catalog list only carries summaries,
  // whose `sections` are always empty, so the curriculum has to come from here.
  const { data, isLoading, isError } = useCourse(slug);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-10">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-xl font-semibold">Course not found</h1>
        <p className="text-muted-foreground">
          This course may have been removed or is no longer available.
        </p>
      </div>
    );
  }

  return <CourseDetail course={toLegacyCourseDetail(data)} />;
}
