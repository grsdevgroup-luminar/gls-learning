"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { instructorApi, type CourseSummaryDto } from "@/lib/api/endpoints";
import { CourseStatusBadge } from "@/components/shared/course-status-badge";
import { CourseArt } from "@/components/shared/course-art";
import { StatStrip, Stat } from "@/components/shared/stat-strip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsd, compactNumber } from "@/lib/format";
import {
  BookOpen, Users, Star, DollarSign, Plus, ArrowRight, Pencil, Sparkles, Rocket,
  Clock, XCircle, ShieldCheck,
} from "lucide-react";

export default function InstructorOverview() {
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["instructor", "profile"],
    queryFn: instructorApi.profile,
  });

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ["instructor", "courses"],
    queryFn: instructorApi.courses,
  });

  const isLoading = profileLoading || coursesLoading;

  // Approval gate
  if (!profileLoading && profile) {
    if (profile.status === "REJECTED") {
      return (
        <div className="grid min-h-[60vh] place-items-center p-6">
          <div className="max-w-md text-center" style={{ ["--tile" as string]: "var(--tint-rose)" } as React.CSSProperties}>
            <span className="icon-tile mx-auto mb-5 grid size-14 place-items-center">
              <XCircle className="size-7" />
            </span>
            <h1 className="font-heading text-2xl font-bold tracking-tight">Application not approved</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Thanks for applying. After review we&apos;re unable to onboard you as an instructor right now.
              You&apos;re welcome to strengthen your sample and re-apply in the future.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3">
              <Button render={<Link href="/teach" />} variant="outline">Re-apply</Button>
            </div>
            <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-success" /> Quality-reviewed marketplace
            </div>
          </div>
        </div>
      );
    }

    if (profile.status === "PENDING") {
      return (
        <div className="grid min-h-[60vh] place-items-center p-6">
          <div className="max-w-md text-center" style={{ ["--tile" as string]: "var(--tint-amber)" } as React.CSSProperties}>
            <span className="icon-tile mx-auto mb-5 grid size-14 place-items-center">
              <Clock className="size-7" />
            </span>
            <h1 className="font-heading text-2xl font-bold tracking-tight">Your application is under review</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Our team reviews new instructor applications within 1–2 business days. You can already set up
              your profile — course creation unlocks the moment you&apos;re approved.
            </p>
            <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-success" /> Quality-reviewed marketplace
            </div>
          </div>
        </div>
      );
    }
  }

  const published = (courses ?? []).filter((c) => c.status === "PUBLISHED");
  const inReview = (courses ?? []).filter((c) => c.status === "REVIEW").length;
  const firstName = profile?.name?.split(" ")[0] ?? "Instructor";

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Instructor</p>
          {isLoading ? (
            <div className="mt-1 h-9 w-48 animate-pulse rounded bg-muted" />
          ) : (
            <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight">
              Welcome back, {firstName}
            </h1>
          )}
        </div>
        <Button render={<Link href="/instructor/courses/new" />}>
          <Plus /> Create course
        </Button>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card p-5">
              <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
              <div className="mt-3 h-7 w-20 animate-pulse rounded bg-muted" />
              <div className="mt-1.5 h-3 w-28 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : (
        <StatStrip className="grid-cols-2 lg:grid-cols-4">
          <Stat icon={BookOpen} label="Published courses" value={published.length} tint="var(--tint-indigo)" />
          <Stat
            icon={Users}
            label="Total students"
            value={compactNumber(profile?.studentCount ?? 0)}
            tint="var(--tint-sky)"
          />
          <Stat
            icon={Star}
            label="Avg. rating"
            value={profile?.ratingAvg ? profile.ratingAvg.toFixed(2) : "—"}
            tint="var(--tint-amber)"
          />
          <Stat
            icon={DollarSign}
            label="Lifetime earnings"
            value={formatUsd((profile?.earningsCents ?? 0) / 100).replace(".00", "")}
            tint="var(--tint-emerald)"
          />
        </StatStrip>
      )}

      {inReview > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <Rocket className="size-4 shrink-0 text-warning" />
          <span>
            {inReview} {inReview === 1 ? "course is" : "courses are"} awaiting admin review. We&apos;ll notify you once approved.
          </span>
        </div>
      )}

      {/* Courses section */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Your courses</h2>
          {(courses ?? []).length > 0 && (
            <Button variant="ghost" size="sm" render={<Link href="/instructor/courses" />}>
              Manage all <ArrowRight />
            </Button>
          )}
        </div>

        {coursesLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-xl border border-border p-3.5">
                <div className="h-14 w-24 animate-pulse rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : (courses ?? []).length === 0 ? (
          <Card variant="elevated" className="items-center py-12 text-center">
            <CardContent className="flex flex-col items-center gap-3">
              <span
                className="icon-tile grid size-12 place-items-center"
                style={{ ["--tile" as string]: "var(--tint-violet)" } as React.CSSProperties}
              >
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
            {(courses ?? []).map((c, i) => (
              <CourseRow key={c.id} course={c} index={i} />
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
  );
}

function CourseRow({ course, index }: { course: CourseSummaryDto; index: number }) {
  const lessonCount = course.lessonCount ?? 0;
  // Map API status (uppercase) to local CourseStatusBadge expected values (lowercase)
  const statusMap: Record<string, "published" | "draft" | "review"> = {
    PUBLISHED: "published",
    DRAFT: "draft",
    REVIEW: "review",
  };
  const status = statusMap[course.status] ?? "draft";

  return (
    <div className={`flex items-center gap-4 p-3.5 ${index > 0 ? "border-t border-border" : ""}`}>
      <CourseArt seed={course.thumbnail} title={course.title} className="h-14 w-24 shrink-0 rounded-lg" iconSize={22} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{course.title}</span>
          <CourseStatusBadge status={status} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{lessonCount} lessons</span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" /> {compactNumber(course.studentCount)}
          </span>
          <span>{formatUsd(course.basePriceCents / 100).replace(".00", "")}</span>
        </div>
      </div>
      <Button variant="outline" size="sm" render={<Link href={`/instructor/courses/${course.id}/edit`} />}>
        <Pencil /> Edit
      </Button>
    </div>
  );
}
