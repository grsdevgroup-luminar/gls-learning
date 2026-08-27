"use client";

import Link from "next/link";
import { useState } from "react";
import { useActivity, useMyEnrollments } from "@/lib/api/hooks";
import { Meter } from "@/components/shared/meter";
import { CourseArt } from "@/components/shared/course-art";
import { AreaTrend } from "@/components/charts/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, Clock, TrendingUp, PlayCircle, Award } from "lucide-react";
import { formatDuration } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PERIODS = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" } as const;
type ActivityPeriod = keyof typeof PERIODS;

export default function ProgressPage() {
  const { data: enrollments, isLoading } = useMyEnrollments();
  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriod>("weekly");
  const { data: activity } = useActivity(activityPeriod);

  if (isLoading) {
    return (
      <div className="space-y-8 p-6 md:p-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const courses = enrollments ?? [];
  const totalLessons = courses?.reduce((s, e) => s + e.completedCount, 0) ?? 0;
  const timeLearnedSec = courses?.reduce((s, e) => s + e.timeLearnedSec, 0) ?? 0;
  const overall = courses.length
    ? Math.round((courses?.reduce((s, e) => s + e.progressPct, 0) ?? 0) / courses.length)
    : 0;
  const completed = courses?.filter((e) => e.status === "COMPLETED").length ?? 0;
  const activityMinutes = activity?.reduce((total, day) => total + day.minutes, 0) ?? 0;
  const activeDays = activity?.filter((day) => day.minutes > 0).length ?? 0;

  const stats = [
    { icon: Target, label: "Overall completion", value: `${overall}%` },
    { icon: PlayCircle, label: "Lessons completed", value: totalLessons },
    { icon: Clock, label: "Time learned", value: formatDuration(timeLearnedSec) },
    { icon: Award, label: "Courses completed", value: completed },
  ];

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My progress</h1>
        <p className="text-muted-foreground">Track your learning momentum across all courses.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold leading-none">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> {PERIODS[activityPeriod]} activity
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Activity is the minutes from lessons you completed during this period.
            </p>
          </div>
          <Select value={activityPeriod} onValueChange={(value) => value && setActivityPeriod(value as ActivityPeriod)}>
            <SelectTrigger className="w-full sm:w-32" aria-label="Activity period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIODS) as ActivityPeriod[]).map((period) => (
                <SelectItem key={period} value={period}>{PERIODS[period]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <AreaTrend
            data={activity?.map((d) => ({
              day: activityPeriod === "weekly"
                ? WEEKDAY_LABEL[new Date(`${d.date}T00:00:00Z`).getUTCDay()]
                : activityPeriod === "daily" ? "Today" : d.date.slice(5),
              minutes: d.minutes,
            })) ?? []}
            xKey="day"
            yKey="minutes"
            prefix=""
            height={220}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
            <span>{activityMinutes} minutes across {activeDays} active {activeDays === 1 ? "day" : "days"}</span>
            <span>Course progress = completed lessons ÷ total lessons.</span>
          </div>
          {activity?.every((d) => d.minutes === 0) && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Activity data will appear as you learn
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-bold">Course completion</h2>
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven&apos;t enrolled in any courses yet.</p>
        ) : (
          <div className="space-y-3">
            {courses?.map((enrollment) => {
              const actionHref =
                enrollment.progressPct === 100
                  ? `/courses/${enrollment.course.slug}#write-a-review`
                  : `/learn/${enrollment.course.slug}`;

              return (
                <Card key={enrollment.id} className="p-0">
                  <CardContent className="flex items-center gap-4 p-4">
                    <CourseArt
                      seed={enrollment.course.thumbnail ?? enrollment.course.slug}
                      title={enrollment.course.title}
                      className="h-14 w-20 shrink-0 rounded-lg"
                      iconSize={22}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{enrollment.course.title}</span>
                        {enrollment.progressPct === 100 && (
                          <Badge variant="secondary" className="text-success">
                            <Award className="mr-1 h-3 w-3" />Done
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {enrollment.completedCount}/{enrollment.lessonCount} lessons
                      </p>
                      <Meter value={enrollment.progressPct} height={6} className="mt-2" />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold tabular-nums">{enrollment.progressPct}%</span>
                      <Button size="sm" variant="outline" render={<Link href={actionHref} />}>
                        {enrollment.progressPct === 100 ? "Review" : "Resume"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
