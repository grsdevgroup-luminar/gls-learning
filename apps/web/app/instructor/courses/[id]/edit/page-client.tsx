"use client";

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