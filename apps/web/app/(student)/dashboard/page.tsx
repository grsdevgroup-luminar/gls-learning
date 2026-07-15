"use client";

import Link from "next/link";
import { useMyEnrollments, useCourses } from "@/lib/api/hooks";
import { useSession } from "@/lib/api/session";
import { CourseArt } from "@/components/shared/course-art";
import { Meter } from "@/components/shared/meter";
import { CircularProgress } from "@/components/shared/circular-progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen, Clock, Award, PlayCircle, ArrowRight, Bell, ChevronRight, TrendingUp,
} from "lucide-react";
import { formatHoursFromMin } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { user, isLoading: sessionLoading } = useSession();
  const { data: enrollments, isLoading: enrollLoading } = useMyEnrollments();
  const { data: coursesPage, isLoading: coursesLoading } = useCourses({ page: 1, limit: 4 });

  const isLoading = sessionLoading || enrollLoading;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-10 p-6 md:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-56" />
          </div>
          <Skeleton className="h-9 w-36" />
        </header>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const enrolled = enrollments ?? [];

  // Most-recently active in-progress course becomes the resume card
  const inProgress = enrolled
    .filter((e) => e.status === "IN_PROGRESS")
    .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());

  const completed = enrolled.filter((e) => e.status === "COMPLETED");
  const resume = inProgress[0] ?? null;

  const totalMinutes = enrolled.reduce((sum, e) => sum + e.minutesWatched, 0);

  const enrolledCourseIds = new Set(enrolled.map((e) => e.courseId));
  const recommended = (coursesPage?.items ?? [])
    .filter((c) => !enrolledCourseIds.has(c.id))
    .slice(0, 4);

  const stats = [
    { icon: BookOpen,    label: "Enrolled",    value: enrolled.length,              tint: "var(--tint-indigo)"  },
    { icon: Clock,       label: "Time learned", value: formatHoursFromMin(totalMinutes), tint: "var(--tint-sky)" },
    { icon: TrendingUp,  label: "In progress",  value: inProgress.length,            tint: "var(--tint-amber)"  },
    { icon: Award,       label: "Certificates", value: completed.length,             tint: "var(--tint-emerald)" },
  ];

  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto max-w-6xl space-y-10 p-6 md:p-10">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Dashboard</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Welcome back, {firstName}
          </h1>
        </div>
        <Button variant="outline" render={<Link href="/courses" />}>
          Browse courses <ArrowRight />
        </Button>
      </header>

      {/* Stat strip + learning stats panel */}
      <section className="grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm lg:grid-cols-[3fr_2fr]">
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4 lg:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="group bg-card p-5"
              style={{ ["--tile" as string]: s.tint }}
            >
              <span className="icon-tile size-8">
                <s.icon className="size-4" />
              </span>
              <div className="mt-3 text-2xl font-bold leading-none tracking-tight tabular-nums">
                {s.value}
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
        {/* Learning stats (replaces streak — no real streak data) */}
        <div className="flex items-center justify-between gap-4 bg-card p-5">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <TrendingUp className="size-4 text-primary" /> Learning stats
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {completed.length} course{completed.length !== 1 ? "s" : ""} completed
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-2xl font-bold tabular-nums">{formatHoursFromMin(totalMinutes)}</span>
            <span className="text-xs text-muted-foreground">total watch time</span>
          </div>
        </div>
      </section>

      {/* Resume card */}
      {resume && (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="grid md:grid-cols-[2fr_3fr]">
            <div className="relative">
              <CourseArt
                seed={resume.course.thumbnail}
                title={resume.course.title}
                category={resume.course.category}
                className="h-full min-h-48"
                iconSize={56}
              />
              <div className="absolute inset-0 grid place-items-center bg-black/15">
                <span className="grid size-12 place-items-center rounded-full bg-background/90 text-primary shadow-lg backdrop-blur">
                  <PlayCircle className="size-6" />
                </span>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-3 p-7">
              <Badge variant="secondary" className="w-fit">Continue learning</Badge>
              <h2 className="text-xl font-bold tracking-tight">{resume.course.title}</h2>
              <p className="text-sm text-muted-foreground">
                {resume.course.instructor.name} · {resume.completedCount}/{resume.lessonCount} lessons complete
              </p>
              <div className="flex items-center gap-3">
                <Meter value={resume.progressPct} className="max-w-xs" />
                <span className="text-sm font-semibold tabular-nums">{resume.progressPct}%</span>
              </div>
              <Button className="w-fit" render={<Link href={`/learn/${resume.course.slug}`} />}>
                <PlayCircle /> Resume course
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Full enrolled course list */}
      {enrolled.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your courses
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {enrolled.map((e, i) => (
              <Link
                key={e.id}
                href={`/learn/${e.course.slug}`}
                className={cn(
                  "group flex items-center gap-4 p-3.5 transition-colors hover:bg-secondary/50",
                  i > 0 && "border-t border-border",
                )}
              >
                <CourseArt
                  seed={e.course.thumbnail}
                  title={e.course.title}
                  className="h-14 w-24 shrink-0 rounded-lg"
                  iconSize={22}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="truncate text-sm font-semibold group-hover:text-primary">
                    {e.course.title}
                  </span>
                  <div className="flex items-center gap-3">
                    <Meter value={e.progressPct} height={5} className="max-w-48" />
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {e.completedCount}/{e.lessonCount} · {e.progressPct}%
                    </span>
                  </div>
                </div>
                {e.status === "COMPLETED" ? (
                  <CircularProgress value={100} size={32} strokeWidth={3} showLabel={false} className="shrink-0">
                    <Award className="size-4 text-success" />
                  </CircularProgress>
                ) : (
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Empty state — no enrollments */}
      {enrolled.length === 0 && (
        <section className="rounded-xl border border-border bg-card p-10 text-center">
          <BookOpen className="mx-auto mb-3 size-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">No courses yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Browse the catalog to find your first course.</p>
          <Button className="mt-4" render={<Link href="/courses" />}>
            Browse courses
          </Button>
        </section>
      )}

      {/* Reminder nudge */}
      <section className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-secondary/50 p-5">
        <div className="grid size-10 place-items-center rounded-lg border border-border bg-card text-primary">
          <Bell className="size-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Stay on track with smart reminders</h3>
          <p className="text-sm text-muted-foreground">
            We'll nudge you by email or SMS if you go idle — manage exactly how in your account.
          </p>
        </div>
        <Button variant="outline" render={<Link href="/account" />}>
          Reminder settings
        </Button>
      </section>

      {/* Recommended for you */}
      {!coursesLoading && recommended.length > 0 && (
        <section>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recommended for you
            </h2>
            <Button variant="ghost" size="sm" render={<Link href="/courses" />}>
              See all <ArrowRight />
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {recommended.map((c) => (
              <Link
                key={c.id}
                href={`/courses/${c.slug}`}
                className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <CourseArt
                  seed={c.thumbnail}
                  title={c.title}
                  category={c.category}
                  className="aspect-16/10"
                  iconSize={40}
                />
                <div className="p-3">
                  <p className="truncate text-sm font-semibold group-hover:text-primary">{c.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.instructor.name}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
