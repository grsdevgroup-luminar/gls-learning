"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, partnerApi } from "@/lib/api/endpoints";
import { useSession } from "@/lib/api/session";
import { getApiErrorMessage } from "@/lib/api/errors";
import { CourseArt } from "@/components/shared/course-art";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Handshake, Play, Plus, Lock, Globe, PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { CourseGridSkeleton, PageHeaderSkeleton } from "@/components/shared/loading-skeletons";

/**
 * Deliberately a separate page from /dashboard/team, not a merged section —
 * see DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §6.3 for the reasoning (an org
 * membership and a delivery-partner grant are different-shaped relationships;
 * conflating them under "Team" would misrepresent where a course came from).
 */
export default function PartnerCoursesPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { user } = useSession();

  const { data: granted, isLoading } = useQuery({
    queryKey: ["me", "delivery-partner", "granted-courses"],
    queryFn: partnerApi.grantedCourses,
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

  if (isLoading) {
    return <div className="space-y-8 p-6 md:p-8"><PageHeaderSkeleton /><CourseGridSkeleton count={3} /></div>;
  }

  if (!granted || granted.length === 0) {
    return (
      <div className="p-6 md:p-8">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Handshake className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No partner-granted courses yet. When a delivery partner invites you to a course, it appears here.
          </p>
        </div>
      </div>
    );
  }

  // Group by partner, same visual pattern as /dashboard/team grouping by org.
  const byPartner = new Map<string, typeof granted>();
  for (const g of granted) {
    const list = byPartner.get(g.partnerName) ?? [];
    list.push(g);
    byPartner.set(g.partnerName, list);
  }

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Partner courses</h1>
        <p className="text-muted-foreground">Courses a delivery partner has given you access to — free to enroll.</p>
      </div>

      {[...byPartner.entries()].map(([partnerName, courses]) => (
        <section key={partnerName} className="space-y-3">
          <div className="flex items-center gap-2">
            <Handshake className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">{partnerName}</h2>
          </div>

          {courses[0]?.partnerSuspended ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-warning/50 bg-warning/5 p-4 text-sm text-muted-foreground">
              <PauseCircle className="h-4 w-4 shrink-0 text-warning" />
              This partner's account is currently suspended — access may be paused.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((g) => {
                const c = g.course;
                const enrolled = enrolledIds.has(c.id);
                const ownCourse = !!user?.id && c.instructor.id === user.id;
                return (
                  <Card key={g.courseAssignmentId}>
                    <CardContent className="flex flex-col gap-3 p-4">
                      <div className="flex gap-3">
                        <CourseArt seed={c.thumbnail} title={c.title} className="h-14 w-14 shrink-0 rounded-lg" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{c.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{c.category} · {c.level}</div>
                          {c.visibility === "PRIVATE" ? (
                            <div className="mt-1.5 flex items-center gap-1 text-xs text-primary">
                              <Lock className="h-3 w-3" /> Private · included
                            </div>
                          ) : (
                            <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <Globe className="h-3 w-3" /> Public · included
                            </div>
                          )}
                        </div>
                      </div>
                      {enrolled ? (
                        <Button variant="outline" size="sm" className="w-full" render={<Link href={`/learn/${c.slug}`} />}>
                          <Play className="h-4 w-4" /> Continue
                        </Button>
                      ) : ownCourse ? (
                        <Button variant="outline" size="sm" className="w-full" disabled>
                          You manage this course
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => enroll.mutate(c.id)}
                          disabled={enroll.isPending && enroll.variables === c.id}
                        >
                          <Plus className="h-4 w-4" /> {enroll.isPending && enroll.variables === c.id ? "Enrolling…" : "Enroll"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
