"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CourseBuilder } from "@/components/shared/course-builder";
import { authoringApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { toast } from "sonner";

export default function EditCoursePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: pendingRequests } = useQuery({
    queryKey: ["admin", "course-revision-requests", "PENDING"],
    queryFn: () => authoringApi.courseRevisionRequests("PENDING"),
  });
  const revisionRequest = pendingRequests?.find((request) => request.revisionCourseId === id);
  const approve = useMutation({
    mutationFn: authoringApi.approveCourseRevision,
    onSuccess: () => {
      toast.success("Course changes approved and published");
      void qc.invalidateQueries({ queryKey: ["admin", "course-revision-requests"] });
      void qc.invalidateQueries({ queryKey: ["admin", "courses"] });
      router.push("/admin/courses?tab=revision-requests");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <CourseBuilder
      courseId={id}
      revisionApprovalRequestId={revisionRequest?.id}
      onApproveRevision={revisionRequest ? () => approve.mutate(revisionRequest.id) : undefined}
      approvingRevision={approve.isPending}
    />
  );
}