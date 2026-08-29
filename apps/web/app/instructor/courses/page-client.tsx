"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { instructorApi, type CourseSummaryDto } from "@/lib/api/endpoints";
import { CourseStatusBadge } from "@/components/shared/course-status-badge";
import { CourseArt } from "@/components/shared/course-art";
import { Stars } from "@/components/shared/stars";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd, compactNumber } from "@/lib/format";
import { Plus, Users, Pencil, Eye, Sparkles } from "lucide-react";

export default function InstructorCourses() {
  const { data: courses, isLoading, error } = useQuery({
    queryKey: ["instructor", "courses"],
    queryFn: instructorApi.courses,
  });

  const count = courses?.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">My Courses</h1>
          {isLoading ? (
            <div className="mt-1 h-4 w-24 animate-pulse rounded bg-muted" />
          ) : (
            <p className="text-sm text-muted-foreground">
              {count} {count === 1 ? "course" : "courses"}
            </p>
          )}
        </div>
        <Button render={<Link href="/instructor/courses/new" />}><Plus /> Create course</Button>
      </header>

      {error && (
        <p className="text-sm text-destructive">Failed to load courses.</p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} variant="interactive" className="flex-row items-center gap-4 p-4">
              <div className="h-16 w-28 animate-pulse rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-48 animate-pulse rounded bg-muted" />
                <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                <div className="h-3 w-40 animate-pulse rounded bg-muted" />
              </div>
            </Card>
          ))}
        </div>
      ) : count === 0 ? (
        <Card variant="elevated" className="items-center py-14 text-center">
          <CardContent className="flex flex-col items-center gap-3">
            <span
              className="icon-tile grid size-12 place-items-center"
              style={{ ["--tile" as string]: "var(--tint-violet)" } as React.CSSProperties}
            >
              <Sparkles className="size-6" />
            </span>
            <p className="font-heading font-semibold">No courses yet</p>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              Create your first course and submit it for review to start teaching.
            </p>
            <Button render={<Link href="/instructor/courses/new" />}><Plus /> Create course</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(courses ?? []).map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function CourseCard({ course }: { course: CourseSummaryDto }) {
  const lessonCount = course.lessonCount ?? 0;

  return (
    <Card variant="interactive" className="flex-row items-center gap-4 p-4">
      <CourseArt seed={course.thumbnail} title={course.title} className="h-16 w-28 shrink-0 rounded-lg" iconSize={24} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold">{course.title}</span>
          <CourseStatusBadge status={course.status} />
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{course.subtitle}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{lessonCount} lessons</span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" /> {compactNumber(course.studentCount)}
          </span>
          {course.ratingAvg > 0 && <Stars rating={course.ratingAvg} size={11} showValue />}
          <span>{formatUsd(course.basePriceCents / 100).replace(".00", "")} base price</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        {course.status === "PUBLISHED" && (
          <Button variant="ghost" size="sm" render={<Link href={`/courses/${course.slug}`} />}>
            <Eye /> View
          </Button>
        )}
        <Button variant="outline" size="sm" render={<Link href={`/instructor/courses/${course.id}/edit`} />}>
          <Pencil /> Edit
        </Button>
      </div>
    </Card>
  );
}
