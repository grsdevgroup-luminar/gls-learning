"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CourseBuilder } from "@/components/shared/course-builder";
import { authoringApi } from "@/lib/api/endpoints";
import { ApprovalGate } from "../../../_components/approval-gate";

function RevisionAwareBuilder({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["authoring", "course-revision", id],
    queryFn: () => authoringApi.ensureCourseRevision(id),
  });

  if (isLoading) return <div className="min-h-screen animate-pulse bg-background" />;
  if (error || !data) return <p className="p-8 text-sm text-destructive">Unable to open this course.</p>;

  if (data.request?.status === "PENDING") {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold">Course changes are under review</h1>
        <p className="text-sm text-muted-foreground">
          Your submitted version is locked while the admin reviews it. Students continue to see the current live course until approval.
        </p>
        <Link className="text-sm text-primary underline" href="/instructor/courses">
          Back to my courses
        </Link>
      </div>
    );
  }
  return (
    <CourseBuilder
      courseId={data.courseId}
      mode="instructor"
      revisionMode={data.isRevision}
    />
  );
}

export default function EditInstructorCourse() {
  const { id } = useParams<{ id: string }>();
  return (
    <ApprovalGate>
      <RevisionAwareBuilder id={id} />
    </ApprovalGate>
  );
}