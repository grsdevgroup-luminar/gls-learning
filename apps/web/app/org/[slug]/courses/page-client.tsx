"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { orgApi } from "@/lib/api/endpoints";
import { CourseArt } from "@/components/shared/course-art";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Lock, Globe } from "lucide-react";

/**
 * Read-only: which courses a company gets is a platform decision (see
 * OrganizationsService.assertPlatformAdmin) — an org's own admin can see
 * what's been assigned, but assigning/removing courses happens only from
 * the platform admin's Organizations table.
 */
export default function OrgCourses() {
  const params = useParams<{ slug: string }>();

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

  if (!org) return null;

  const assigned = assignedCourses ?? [];

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assigned Courses</h1>
        <p className="text-muted-foreground">
          These courses were curated for {org.name} by SkillStream and are available to all members.
        </p>
      </div>

      {assigned.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No courses assigned yet. Contact SkillStream to add some.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assigned.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex gap-3 p-4">
                <CourseArt seed={c.thumbnail} title={c.title} className="h-14 w-14 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{c.category}</div>
                  {c.visibility === "PRIVATE" ? (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-primary">
                      <Lock className="h-3 w-3" />
                      <span>Private · members only</span>
                    </div>
                  ) : (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Globe className="h-3 w-3" />
                      <span>Public · open catalog</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
