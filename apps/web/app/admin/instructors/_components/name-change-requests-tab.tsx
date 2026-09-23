"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { adminApi, type InstructorNameChangeRequestDto } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { initials } from "@/lib/format";
import { shortDate } from "./application-status";

export function NameChangeRequestsTab({ onMutated }: { onMutated: () => void }) {
  const [rejecting, setRejecting] = useState<InstructorNameChangeRequestDto | null>(null);
  const [note, setNote] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "instructor-name-change-requests"],
    queryFn: () => adminApi.instructorNameChangeRequests({ status: "PENDING", page: 1, pageSize: 50 }),
  });
  const approve = useMutation({
    mutationFn: (id: string) => adminApi.approveInstructorNameChange(id),
    onSuccess: () => {
      onMutated();
      toast.success("Name change approved");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => adminApi.rejectInstructorNameChange(id, note),
    onSuccess: () => {
      onMutated();
      setRejecting(null);
      setNote("");
      toast.success("Name change rejected");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
  const requests = data?.items ?? [];

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-card">
      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading requests…</div>
      ) : requests.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">No pending name-change requests.</div>
      ) : (
        <div className="divide-y">
          {requests.map((request) => (
            <div key={request.id} className="flex flex-wrap items-center gap-4 p-4 md:px-6">
              <Avatar className="size-9"><AvatarFallback>{initials(request.currentName)}</AvatarFallback></Avatar>
              <div className="min-w-48 flex-1">
                <div className="text-sm font-medium">{request.currentName} <span className="text-muted-foreground">→</span> {request.requestedName}</div>
                <div className="text-xs text-muted-foreground">{request.email} · requested {shortDate(request.requestedAt)}</div>
              </div>
              <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10">Pending review</Badge>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => approve.mutate(request.id)} disabled={approve.isPending || reject.isPending}>
                  <Check /> Approve
                </Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => setRejecting(request)} disabled={approve.isPending || reject.isPending}>
                  <X /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rejecting && (
        <div className="border-t p-4 md:px-6">
          <div className="mb-2 text-sm font-medium">Reason for rejecting {rejecting.requestedName}</div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain the decision to the instructor" className="mb-3 max-w-xl" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setRejecting(null); setNote(""); }}>Cancel</Button>
            <Button variant="outline" className="text-destructive" disabled={!note.trim() || reject.isPending} onClick={() => reject.mutate({ id: rejecting.id, note: note.trim() })}>Confirm rejection</Button>
          </div>
        </div>
      )}
    </div>
  );
}