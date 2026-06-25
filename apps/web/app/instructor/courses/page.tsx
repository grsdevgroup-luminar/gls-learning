"use client";

import Link from "next/link";
import { useStore } from "@/lib/context/store";
import { courseLessonCount } from "@/lib/mock/courses";
import { ApprovalGate } from "@/components/instructor/approval-gate";
import { CourseStatusBadge } from "@/components/shared/course-status-badge";
import { CourseArt } from "@/components/shared/course-art";
import { Stars } from "@/components/shared/stars";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd, compactNumber } from "@/lib/format";
import { Plus, Users, Pencil, Rocket, Eye, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function InstructorCourses() {
  const { myCourses, setCourseStatus, mounted } = useStore();
  if (!mounted) return null;

  return (
    <ApprovalGate>
      <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">My Courses</h1>
            <p className="text-sm text-muted-foreground">{myCourses.length} {myCourses.length === 1 ? "course" : "courses"}</p>
          </div>
          <Button render={<Link href="/instructor/courses/new" />}><Plus /> Create course</Button>
        </header>

        {myCourses.length === 0 ? (
          <Card variant="elevated" className="items-center py-14 text-center">
            <CardContent className="flex flex-col items-center gap-3">
              <span className="icon-tile grid size-12 place-items-center" style={{ ["--tile" as string]: "var(--tint-violet)" }}>
                <Sparkles className="size-6" />
              </span>
              <p className="font-heading font-semibold">No courses yet</p>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">Create your first course and submit it for review to start teaching.</p>
              <Button render={<Link href="/instructor/courses/new" />}><Plus /> Create course</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {myCourses.map((c) => (
              <Card key={c.id} variant="interactive" className="flex-row items-center gap-4 p-4">
                <CourseArt seed={c.thumbnail} title={c.title} className="h-16 w-28 shrink-0 rounded-lg" iconSize={24} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{c.title}</span>
                    <CourseStatusBadge status={c.status} />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{c.subtitle}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>{courseLessonCount(c)} lessons</span>
                    <span className="inline-flex items-center gap-1"><Users className="size-3" /> {compactNumber(c.studentCount)}</span>
                    {c.rating > 0 && <Stars rating={c.rating} size={11} showValue />}
                    <span>{formatUsd(c.revenue).replace(".00", "")} earned</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  {c.status === "published" && (
                    <Button variant="ghost" size="sm" render={<Link href={`/courses/${c.slug}`} />}>
                      <Eye /> View
                    </Button>
                  )}
                  {c.status === "draft" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCourseStatus(c.id, "review");
                        toast.success("Submitted for review 📩", { description: c.title });
                      }}
                    >
                      <Rocket /> Submit
                    </Button>
                  )}
                  <Button variant="outline" size="sm" render={<Link href={`/instructor/courses/${c.id}/edit`} />}>
                    <Pencil /> Edit
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ApprovalGate>
  );
}
