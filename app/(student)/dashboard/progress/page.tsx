"use client";

import Link from "next/link";
import { useStore } from "@/lib/context/store";
import { getCourseById, courseLessonCount } from "@/lib/mock/courses";
import { getInstructor } from "@/lib/mock/instructors";
import { demoStudent } from "@/lib/mock/students";
import { Meter } from "@/components/shared/meter";
import { CourseArt } from "@/components/shared/course-art";
import { AreaTrend } from "@/components/charts/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, Target, Clock, TrendingUp, PlayCircle, Award } from "lucide-react";
import { formatHoursFromMin } from "@/lib/format";

const weekly = [
  { day: "Mon", minutes: 35 },
  { day: "Tue", minutes: 52 },
  { day: "Wed", minutes: 18 },
  { day: "Thu", minutes: 64 },
  { day: "Fri", minutes: 41 },
  { day: "Sat", minutes: 78 },
  { day: "Sun", minutes: 46 },
];

export default function ProgressPage() {
  const { enrolled, completedCount, mounted } = useStore();
  if (!mounted) return <div className="p-6 md:p-8" />;

  const courses = enrolled.map((id) => getCourseById(id)).filter(Boolean).map((c) => {
    const total = courseLessonCount(c!);
    const done = completedCount(c!.id);
    return { course: c!, total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  });

  const overall = courses.length
    ? Math.round(courses.reduce((s, c) => s + c.pct, 0) / courses.length)
    : 0;
  const lessonsDone = courses.reduce((s, c) => s + c.done, 0);
  const minutes = demoStudent.enrollments.reduce((s, e) => s + e.minutesWatched, 0);

  const stats = [
    { icon: Target, label: "Overall completion", value: `${overall}%` },
    { icon: PlayCircle, label: "Lessons completed", value: lessonsDone },
    { icon: Clock, label: "Time learned", value: formatHoursFromMin(minutes) },
    { icon: Flame, label: "Current streak", value: `${demoStudent.streakDays} days` },
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" /> This week's activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AreaTrend data={weekly} xKey="day" yKey="minutes" prefix="" height={220} />
          <p className="mt-2 text-center text-xs text-muted-foreground">Minutes learned per day</p>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-bold">Course completion</h2>
        <div className="space-y-3">
          {courses.map(({ course, pct, done, total }) => (
            <Card key={course.id} className="p-0">
              <CardContent className="flex items-center gap-4 p-4">
                <CourseArt seed={course.thumbnail} title={course.title} className="h-14 w-20 shrink-0 rounded-lg" iconSize={22} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{course.title}</span>
                    {pct === 100 && <Badge variant="secondary" className="text-success"><Award className="mr-1 h-3 w-3" />Done</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{getInstructor(course.instructorId)?.name} · {done}/{total} lessons</p>
                  <Meter value={pct} height={6} className="mt-2" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold tabular-nums">{pct}%</span>
                  <Button size="sm" variant="outline" render={<Link href={`/learn/${course.slug}`} />}>
                    {pct === 100 ? "Review" : "Resume"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
