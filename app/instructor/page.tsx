"use client";

import Link from "next/link";
import { useStore } from "@/lib/context/store";
import { courseLessonCount } from "@/lib/mock/courses";
import { ApprovalGate } from "@/components/instructor/approval-gate";
import { CourseStatusBadge } from "@/components/shared/course-status-badge";
import { CourseArt } from "@/components/shared/course-art";
import { StatStrip, Stat } from "@/components/shared/stat-strip";
import { Stars } from "@/components/shared/stars";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsd, compactNumber } from "@/lib/format";
import {
  BookOpen, Users, Star, DollarSign, Plus, ArrowRight, Pencil, Sparkles, Rocket,
} from "lucide-react";

export default function InstructorOverview() {
  const { currentInstructor, myCourses, mounted } = useStore();
  if (!mounted || !currentInstructor) return null;

  const published = myCourses.filter((c) => c.status === "published");
  const totalStudents = myCourses.reduce((s, c) => s + c.studentCount, 0);
  const totalRevenue = myCourses.reduce((s, c) => s + c.revenue, 0);
  const rated = published.filter((c) => c.rating > 0);
  const avgRating = rated.length
    ? rated.reduce((s, c) => s + c.rating, 0) / rated.length
    : 0;
  const inReview = myCourses.filter((c) => c.status === "review").length;

  return (
    <ApprovalGate>
      <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Instructor</p>
            <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight">
              Welcome back, {currentInstructor.name.split(" ")[0]}
            </h1>
          </div>
          <Button render={<Link href="/instructor/courses/new" />}>
            <Plus /> Create course
          </Button>
        </header>

        <StatStrip className="grid-cols-2 lg:grid-cols-4">
          <Stat icon={BookOpen} label="Published courses" value={published.length} tint="var(--tint-indigo)" />
          <Stat icon={Users} label="Total students" value={compactNumber(totalStudents)} tint="var(--tint-sky)" />
          <Stat icon={Star} label="Avg. rating" value={avgRating ? avgRating.toFixed(2) : "—"} tint="var(--tint-amber)" />
          <Stat icon={DollarSign} label="Lifetime earnings" value={formatUsd(totalRevenue).replace(".00", "")} tint="var(--tint-emerald)" />
        </StatStrip>

        {inReview > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
            <Rocket className="size-4 shrink-0 text-warning" />
            <span>
              {inReview} {inReview === 1 ? "course is" : "courses are"} awaiting admin review. We&apos;ll notify you once approved.
            </span>
          </div>
        )}

        {/* Courses */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">Your courses</h2>
            {myCourses.length > 0 && (
              <Button variant="ghost" size="sm" render={<Link href="/instructor/courses" />}>
                Manage all <ArrowRight />
              </Button>
            )}
          </div>

          {myCourses.length === 0 ? (
            <Card variant="elevated" className="items-center py-12 text-center">
              <CardContent className="flex flex-col items-center gap-3">
                <span className="icon-tile grid size-12 place-items-center" style={{ ["--tile" as string]: "var(--tint-violet)" }}>
                  <Sparkles className="size-6" />
                </span>
                <div>
                  <p className="font-heading font-semibold">Create your first course</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                    Build your curriculum, add lessons and quizzes, then submit it for review. We&apos;ll help you launch.
                  </p>
                </div>
                <Button render={<Link href="/instructor/courses/new" />}><Plus /> Create course</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {myCourses.map((c, i) => (
                <div
                  key={c.id}
                  className={`flex items-center gap-4 p-3.5 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <CourseArt seed={c.thumbnail} title={c.title} className="h-14 w-24 shrink-0 rounded-lg" iconSize={22} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{c.title}</span>
                      <CourseStatusBadge status={c.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{courseLessonCount(c)} lessons</span>
                      <span className="inline-flex items-center gap-1"><Users className="size-3" /> {compactNumber(c.studentCount)}</span>
                      {c.rating > 0 && <Stars rating={c.rating} size={11} showValue />}
                      <span>{formatUsd(c.revenue).replace(".00", "")}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" render={<Link href={`/instructor/courses/${c.id}/edit`} />}>
                    <Pencil /> Edit
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Profile teaser */}
        <Card>
          <CardHeader><CardTitle className="text-base">Grow your audience</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
            <p className="max-w-md">
              A complete profile with a clear headline and bio earns more enrollments. Keep yours sharp.
            </p>
            <Button variant="outline" render={<Link href="/instructor/profile" />}>Edit profile</Button>
          </CardContent>
        </Card>
      </div>
    </ApprovalGate>
  );
}
