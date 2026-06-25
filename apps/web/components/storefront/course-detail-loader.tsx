"use client";

import { useStore } from "@/lib/context/store";
import { CourseDetail } from "@/components/storefront/course-detail";

export function CourseDetailLoader({ slug }: { slug: string }) {
  const { courses, mounted } = useStore();
  if (!mounted) return null;

  const course = courses.find((c) => c.slug === slug);
  if (!course) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-xl font-semibold">Course not found</h1>
        <p className="text-muted-foreground">
          This course may have been removed or is no longer available.
        </p>
      </div>
    );
  }

  return <CourseDetail course={course} />;
}
