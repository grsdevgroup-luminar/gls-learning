"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authoringApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export function RevisionRequestsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "course-revision-requests", "PENDING"],
    queryFn: () => authoringApi.courseRevisionRequests("PENDING"),
  });
  const approve = useMutation({
    mutationFn: authoringApi.approveCourseRevision,
    onSuccess: () => {
      toast.success("Course changes approved and published");
      void qc.invalidateQueries({ queryKey: ["admin", "course-revision-requests"] });
      void qc.invalidateQueries({ queryKey: ["admin", "courses"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => authoringApi.rejectCourseRevision(id, note),
    onSuccess: () => {
      toast.success("Revision request rejected");
      void qc.invalidateQueries({ queryKey: ["admin", "course-revision-requests"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  if (isLoading) return <div className="h-32 animate-pulse rounded-xl bg-muted" />;
  if (!data?.length) return <Card><CardContent className="p-6 text-sm text-muted-foreground">No pending course change requests.</CardContent></Card>;

  return (
    <div className="space-y-3">
      {data.map((request) => (
        <Card key={request.id}>
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">{request.courseTitle}</p>
                <Badge variant="outline" className="text-warning">Change requested</Badge>
              </div>
              <p className="text-sm text-muted-foreground">By {request.instructorName} · {new Date(request.requestedAt).toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">The live course remains unchanged until approval.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" render={<Link href={`/admin/courses/${request.revisionCourseId}/edit?revisionRequestId=${request.id}`} />}>Review changes</Button>
              <Button size="sm" onClick={() => approve.mutate(request.id)} disabled={approve.isPending}>Approve</Button>
              <Button size="sm" variant="destructive" onClick={() => reject.mutate({ id: request.id, note: window.prompt("Reason for rejection (optional)") ?? "" })} disabled={reject.isPending}>Reject</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}