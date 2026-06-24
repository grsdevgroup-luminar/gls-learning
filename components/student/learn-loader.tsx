"use client";

import { useStore } from "@/lib/context/store";
import { LearnClient } from "@/components/student/learn-client";

export function LearnLoader({ slug }: { slug: string }) {
  const { courses, mounted } = useStore();
  if (!mounted) return null;

  const course = courses.find((c) => c.slug === slug);
  if (!course) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-xl font-semibold">Course not found</h1>
        <p className="text-muted-foreground">
          This course may have been removed or is no longer available.
        </p>
      </div>
    );
  }

  return <LearnClient course={course} />;
}
