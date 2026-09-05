"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orgApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { CourseArt } from "@/components/shared/course-art";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AssignCourseDialog } from "@/components/shared/assign-course-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { X, BookOpen, Lock } from "lucide-react";
import { toast } from "sonner";

export default function OrgCourses() {
  const params = useParams<{ slug: string }>();
  const qc = useQueryClient();

  const { data: org } = useQuery({
    queryKey: ["org", params.slug],
    queryFn: () => orgApi.bySlug(params.slug),
    enabled: !!params.slug,
  });
  const { data: assignedCourses } = useQuery({
    queryKey: ["org", org?.id, "courses"],
    queryFn: () => orgApi.courses(org!.id),
    enabled: !!org?.id,
  });

  const unassignMutation = useMutation({
    mutationFn: (courseId: string) => orgApi.unassignCourse(org!.id, courseId),
    onSuccess: () => {
      toast.success("Course removed from organization");
      void qc.invalidateQueries({ queryKey: ["org", org?.id, "courses"] });
      void qc.invalidateQueries({ queryKey: ["store", "courses"] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  if (!org) return null;

  const assigned = assignedCourses ?? [];
  const assignedIds = new Set(assigned.map((c) => c.id));

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assigned Courses</h1>
          <p className="text-muted-foreground">
            These private courses are available to all {org.name} members.
          </p>
        </div>
        <AssignCourseDialog orgId={org.id} assignedIds={assignedIds} />
      </div>

      {assigned.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No courses assigned yet. Click &quot;Assign course&quot; to add one.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assigned.map((c) => (
            <Card key={c.id} className="relative">
              <CardContent className="flex gap-3 p-4">
                <CourseArt seed={c.thumbnail} title={c.title} className="h-14 w-14 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate text-sm font-medium">{c.title}</div>
                    <ConfirmDialog
                      trigger={
                        <button
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label="Remove course"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      }
                      title={`Remove "${c.title}"?`}
                      description="This course will no longer be available to organization members."
                      confirmLabel="Remove"
                      pending={unassignMutation.isPending}
                      onConfirm={async () => { await unassignMutation.mutateAsync(c.id); }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{c.category}</div>
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-primary">
                    <Lock className="h-3 w-3" />
                    <span>Private · members only</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
