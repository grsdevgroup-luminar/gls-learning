"use client";

import { useState } from "react";
import { useCourses } from "@/lib/api/hooks";
import { CourseCard } from "@/app/(storefront)/_components/course-card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 8;

export function InstructorCourses({ instructorId }: { instructorId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCourses({ instructorId, page, pageSize: PAGE_SIZE });
  const courses = data?.items ?? [];

  if (!isLoading && courses.length === 0 && page === 1) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h2 className="text-2xl font-bold tracking-tight">
        Courses{data && data.total > 0 ? ` (${data.total})` : ""}
      </h2>

      {isLoading ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div key={i} className="aspect-[16/10] animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
