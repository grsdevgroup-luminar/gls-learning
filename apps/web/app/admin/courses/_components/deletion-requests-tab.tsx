"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { adminApi, type CourseDeletionRequestDto } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { relativeDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ReasonConfirmDialog } from "@/components/shared/reason-confirm-dialog";
import { Check, X, Users } from "lucide-react";
import { toast } from "sonner";

export function DeletionRequestsTab({ onMutated }: { onMutated: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "course-deletion-requests"],
    queryFn: () => adminApi.courseDeletionRequests({ status: "PENDING", page: 1, pageSize: 50 }),
  });
  const approve = useMutation({
    mutationFn: (id: string) => adminApi.approveCourseDeletionRequest(id),
    onSuccess: () => {
      onMutated();
      toast.success("Course deleted");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      adminApi.rejectCourseDeletionRequest(id, note),
    onSuccess: () => {
      onMutated();
      toast.success("Deletion request rejected");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
  const requests = data?.items ?? [];

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-card">
      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading requests…</div>
      ) : requests.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">No pending deletion requests.</div>
      ) : (
        <div className="divide-y">
          {requests.map((request) => (
            <div key={request.id} className="flex flex-wrap items-start gap-4 p-4 md:px-6">
              <div className="min-w-48 flex-1">
                <div className="text-sm font-medium">{request.courseTitle}</div>
                <div className="text-xs text-muted-foreground">
                  Requested by {request.instructorName} · {relativeDate(request.requestedAt)}
                </div>
                <div className="mt-1.5 text-sm">{request.reason}</div>
                {request.enrollmentCount > 0 && (
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-warning">
                    <Users className="h-3 w-3" />
                    {request.enrollmentCount} student{request.enrollmentCount === 1 ? "" : "s"} enrolled — deleting will remove their access
                  </div>
                )}
              </div>
              <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10">Pending review</Badge>
              <div className="flex gap-2">
                <ConfirmDialog
                  trigger={
                    <Button size="sm" disabled={approve.isPending || reject.isPending}>
                      <Check /> Approve &amp; delete
                    </Button>
                  }
                  title={`Delete "${request.courseTitle}"?`}
                  description={
                    request.enrollmentCount > 0
                      ? `This can't be completed — ${request.enrollmentCount} student${request.enrollmentCount === 1 ? " is" : "s are"} currently enrolled. Unpublish the course instead of deleting it if you want to stop new enrollments.`
                      : "This permanently deletes the course. This cannot be undone."
                  }
                  confirmLabel="Delete"
                  pending={approve.isPending}
                  onConfirm={async () => {
                    await approve.mutateAsync(request.id);
                  }}
                />
                <ReasonConfirmDialog
                  trigger={
                    <Button size="sm" variant="outline" className="text-destructive" disabled={approve.isPending || reject.isPending}>
                      <X /> Reject
                    </Button>
                  }
                  title={`Reject deletion of "${request.courseTitle}"?`}
                  description="The instructor will see this reason."
                  reasonLabel="Reason for rejecting"
                  reasonPlaceholder="Explain the decision to the instructor"
                  confirmLabel="Confirm rejection"
                  pending={reject.isPending}
                  onConfirm={async (note) => {
                    await reject.mutateAsync({ id: request.id, note });
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
