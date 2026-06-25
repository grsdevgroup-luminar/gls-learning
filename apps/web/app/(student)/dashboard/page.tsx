"use client";

import Link from "next/link";
import { useStore } from "@/lib/context/store";
import { getCourseById, courseLessonCount, publishedCourses } from "@/lib/mock/courses";
import { getInstructor } from "@/lib/mock/instructors";
import { demoStudent } from "@/lib/mock/students";
import { CourseCard } from "@/components/storefront/course-card";
import { CourseArt } from "@/components/shared/course-art";
import { Meter } from "@/components/shared/meter";
import { CircularProgress } from "@/components/shared/circular-progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Flame, BookOpen, Clock, Award, PlayCircle, ArrowRight, Bell, ChevronRight,
} from "lucide-react";
import { formatHoursFromMin } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { enrolled, completedCount, mounted } = useStore();

  if (!mounted) return <div className="p-6 md:p-10" />;

  const courses = enrolled
    .map((id) => getCourseById(id))
    .filter(Boolean)
    .map((c) => {
      const total = courseLessonCount(c!);
      const done = completedCount(c!.id);
      return { course: c!, total, done, pct: total ? Math.round((done / total) * 100) : 0 };
    });

  const inProgress = courses.filter((c) => c.pct < 100).sort((a, b) => b.pct - a.pct);
  const completed = courses.filter((c) => c.pct === 100);
  const resume = inProgress[0];
  const minutesLearned = demoStudent.enrollments.reduce((s, e) => s + e.minutesWatched, 0);

  const recommended = publishedCourses
    .filter((c) => !enrolled.includes(c.id))
    .slice(0, 4);

  const stats = [
    { icon: BookOpen, label: "Enrolled", value: courses.length, tint: "var(--tint-indigo)" },
    { icon: Clock, label: "Time learned", value: formatHoursFromMin(minutesLearned), tint: "var(--tint-sky)" },
    { icon: Flame, label: "Day streak", value: demoStudent.streakDays, tint: "var(--tint-amber)" },
    { icon: Award, label: "Certificates", value: completed.length, tint: "var(--tint-emerald)" },
  ];

  const days = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="mx-auto max-w-6xl space-y-10 p-6 md:p-10">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Dashboard</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Welcome back, {demoStudent.name.split(" ")[0]}
          </h1>
        </div>
        <Button variant="outline" render={<Link href="/courses" />}>
          Browse courses <ArrowRight />
        </Button>
      </header>

      {/* Stat strip + streak — embedded, no floating cards */}
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
        {/* Streak visualization */}
        <div className="flex items-center justify-between gap-4 bg-card p-5">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <Flame className="size-4 text-warning" /> {demoStudent.streakDays}-day streak
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Keep the momentum going</p>
          </div>
          <div className="flex gap-1.5">
            {days.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-md text-[10px] font-semibold transition-colors",
                    i <= 5 ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {i <= 5 ? <Flame className="size-3" /> : ""}
                </span>
                <span className="text-[10px] text-muted-foreground">{d}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Resume */}
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
                {getInstructor(resume.course.instructorId)?.name} · {resume.done}/{resume.total} lessons complete
              </p>
              <div className="flex items-center gap-3">
                <Meter value={resume.pct} className="max-w-xs" />
                <span className="text-sm font-semibold tabular-nums">{resume.pct}%</span>
              </div>
              <Button className="w-fit" render={<Link href={`/learn/${resume.course.slug}`} />}>
                <PlayCircle /> Resume course
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* In-progress list */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Your courses
        </h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {courses.map(({ course, pct, done, total }, i) => (
            <Link
              key={course.id}
              href={`/learn/${course.slug}`}
              className={cn(
                "group flex items-center gap-4 p-3.5 transition-colors hover:bg-secondary/50",
                i > 0 && "border-t border-border",
              )}
            >
              <CourseArt
                seed={course.thumbnail}
                title={course.title}
                className="h-14 w-24 shrink-0 rounded-lg"
                iconSize={22}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="truncate text-sm font-semibold group-hover:text-primary">
                  {course.title}
                </span>
                <div className="flex items-center gap-3">
                  <Meter value={pct} height={5} className="max-w-48" />
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {done}/{total} · {pct}%
                  </span>
                </div>
              </div>
              {pct === 100 ? (
                <CircularProgress value={pct} size={32} strokeWidth={3} showLabel={false} className="shrink-0">
                  <Award className="size-4 text-success" />
                </CircularProgress>
              ) : (
                <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* Reminder hint */}
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

      {/* Recommended */}
      <section>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recommended for you
          </h2>
          <Button variant="ghost" size="sm" render={<Link href="/courses" />}>
            See all <ArrowRight />
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {recommended.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      </section>
    </div>
  );
}
