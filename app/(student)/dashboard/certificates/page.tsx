'use client';

import Link from 'next/link';
import { useStore } from '@/lib/context/store';
import { getCourseById, courseLessonCount } from '@/lib/mock/courses';
import { getInstructor } from '@/lib/mock/instructors';
import { demoStudent } from '@/lib/mock/students';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import {
  Award,
  Lock,
  Download,
  GraduationCap,
  CheckCircle2,
} from 'lucide-react';
import type { Course } from '@/types';

export default function CertificatesPage() {
  const { enrolled, completedCount, mounted } = useStore();
  if (!mounted) return <div className="p-6 md:p-8" />;

  const courses = enrolled
    .map((id) => getCourseById(id))
    .filter(Boolean)
    .map((c) => {
      const total = courseLessonCount(c!);
      const done = completedCount(c!.id);
      return { course: c!, pct: total ? Math.round((done / total) * 100) : 0 };
    });
  const earned = courses.filter((c) => c.pct === 100);
  const inProgress = courses.filter((c) => c.pct < 100);

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Certificates</h1>
        <p className="text-muted-foreground">
          You've earned {earned.length} certificate{earned.length !== 1 && 's'}.
          Finish a course to unlock more.
        </p>
      </div>

      {earned.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {earned.map(({ course }) => (
            <Dialog key={course.id}>
              <DialogTrigger
                nativeButton={false}
                render={
                  <Card className="cursor-pointer p-0 transition-all hover:-translate-y-1 hover:shadow-lg" />
                }
              >
                <CardContent className="p-0">
                  <CertificatePreview course={course} small />
                  <div className="flex items-center justify-between p-3">
                    <span className="text-sm font-medium">{course.title}</span>
                    <Badge variant="secondary" className="text-success">
                      <Award className="mr-1 h-3 w-3" />
                    </Badge>
                  </div>
                </CardContent>
              </DialogTrigger>
              <DialogContent className="max-w-2xl overflow-visible">
                <CertificatePreview course={course} />
                <div className="flex justify-center gap-3">
                  <Button>
                    <Download /> Download PDF
                  </Button>
                  <Button variant="outline">Share to LinkedIn</Button>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      )}

      {inProgress.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-bold">Keep going to unlock</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {inProgress.map(({ course, pct }) => (
              <Card key={course.id}>
                <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Lock className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-semibold">{course.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {pct}% complete — finish to earn your certificate
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1"
                    render={<Link href={`/learn/${course.slug}`} />}
                  >
                    Continue
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {earned.length === 0 && inProgress.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No courses yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CertificatePreview({
  course,
  small,
}: {
  course: Course;
  small?: boolean;
}) {
  const instructor = getInstructor(course.instructorId);
  return (
    <div
      className={`relative overflow-hidden ${small ? 'rounded-t-xl' : 'rounded-xl'} border bg-muted/30 ${small ? 'p-5' : 'p-10'} text-center`}
    >
      <div className="absolute inset-0 m-2 rounded-lg border-2 border-primary/20" />
      <div className="relative">
        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full brand-gradient text-white">
          <GraduationCap className={small ? 'h-5 w-5' : 'h-6 w-6'} />
        </div>
        {!small && (
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Certificate of Completion
          </p>
        )}
        <p
          className={`mt-2 ${small ? 'text-xs' : 'text-sm'} text-muted-foreground`}
        >
          This certifies that
        </p>
        <p className={`font-bold ${small ? 'text-base' : 'text-2xl'}`}>
          {demoStudent.name}
        </p>
        <p
          className={`mt-1 ${small ? 'text-xs' : 'text-sm'} text-muted-foreground`}
        >
          has successfully completed
        </p>
        <p
          className={`font-semibold text-primary ${small ? 'text-sm' : 'text-lg'}`}
        >
          {course.title}
        </p>
        {!small && (
          <div className="mt-6 flex items-center justify-center gap-8 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Verified ·
              SkillStream
            </div>
            <div>Instructor: {instructor?.name}</div>
            <div>June 2026</div>
          </div>
        )}
      </div>
    </div>
  );
}
