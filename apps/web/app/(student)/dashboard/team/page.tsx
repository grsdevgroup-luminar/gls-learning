"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, orgApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { CourseArt } from "@/components/shared/course-art";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, BookOpen, Play, Plus, Lock } from "lucide-react";
import { toast } from "sonner";

export default function TeamCoursesPage() {
  const qc = useQueryClient();
  const router = useRouter();

  const { data: orgs, isLoading } = useQuery({
    queryKey: ["me", "orgs"],
    queryFn: orgApi.mine,
  });
  const { data: enrollments } = useQuery({
    queryKey: ["enrollments"],
    queryFn: api.myEnrollments,
  });

  const enrolledIds = new Set((enrollments ?? []).map((e) => e.courseId));

  const enroll = useMutation({
    mutationFn: (courseId: string) => api.enrollFree(courseId),
    onSuccess: (enrollment) => {
      void qc.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success("Enrolled!", { description: "The course is now in your dashboard." });
      router.push(`/learn/${enrollment.course.slug}`);
    },
    onError: (err) => toast.error("Could not enroll", { description: getApiErrorMessage(err) }),
  });

  if (isLoading) return <div className="p-6 md:p-8 text-muted-foreground">Loading…</div>;

  if (!orgs || orgs.length === 0) {
    return (
      <div className="p-6 md:p-8">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Building2 className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            You&apos;re not part of a team yet. When your company invites you, their courses appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team courses</h1>
        <p className="text-muted-foreground">Courses your organization has made available to you — free to enroll.</p>
      </div>

      {orgs.map((org) => (
        <OrgCourseList
          key={org.id}
          orgId={org.id}
          orgName={org.name}
          enrolledIds={enrolledIds}
          onEnroll={(id) => enroll.mutate(id)}
          enrolling={enroll.isPending ? enroll.variables : undefined}
        />
      ))}
    </div>
  );
}

function OrgCourseList({
  orgId,
  orgName,
  enrolledIds,
  onEnroll,
  enrolling,
}: {
  orgId: string;
  orgName: string;
  enrolledIds: Set<string>;
  onEnroll: (courseId: string) => void;
  enrolling?: string;
}) {
  const { data: courses } = useQuery({
    queryKey: ["org", orgId, "courses"],
    queryFn: () => orgApi.courses(orgId),
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">{orgName}</h2>
        <Badge variant="secondary" className="text-[10px]">{courses?.length ?? 0} courses</Badge>
      </div>

      {!courses || courses.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" /> No courses assigned yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => {
            const enrolled = enrolledIds.has(c.id);
            return (
              <Card key={c.id}>
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex gap-3">
                    <CourseArt seed={c.thumbnail} title={c.title} className="h-14 w-14 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{c.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{c.category} · {c.level}</div>
                      <div className="mt-1.5 flex items-center gap-1 text-xs text-primary">
                        <Lock className="h-3 w-3" /> Private · included
                      </div>
                    </div>
                  </div>
                  {enrolled ? (
                    <Button variant="outline" size="sm" className="w-full" render={<Link href={`/learn/${c.slug}`} />}>
                      <Play className="h-4 w-4" /> Continue
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => onEnroll(c.id)}
                      disabled={enrolling === c.id}
                    >
                      <Plus className="h-4 w-4" /> {enrolling === c.id ? "Enrolling…" : "Enroll"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
