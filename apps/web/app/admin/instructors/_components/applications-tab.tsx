"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { adminApi, type InstructorApplicationDto } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useDebouncedSearch } from "@/lib/use-debounced-value";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Check, X, Eye, Search, FileText } from "lucide-react";
import { toast } from "sonner";
import { initials } from "@/lib/format";
import {
  AdminPagination,
  AdminRowsPerPage,
  ADMIN_PAGE_SIZE_OPTIONS,
} from "../../_components/admin-pagination";
import {
  AdminTableCard,
  stickyHeaderCellClass,
  stickyHeaderRowClass,
} from "../../_components/admin-table";
import { shortDate, statusBadge } from "./application-status";
import { ApplicationDetailDialog } from "./application-detail-dialog";

const STATUS_FILTERS = ["all", "PENDING", "APPROVED", "REJECTED"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export function ApplicationsTab({ onMutated }: { onMutated: () => void }) {
  const [qInput, setQInput] = useState("");
  const q = useDebouncedSearch(qInput);
  const [status, setStatus] = useState<StatusFilter>("PENDING");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(ADMIN_PAGE_SIZE_OPTIONS[0]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);

  useEffect(() => setPage(1), [q, status, pageSize]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "instructor-applications", { q, status, page, pageSize }],
    queryFn: () =>
      adminApi.instructorApplications({
        q: q || undefined,
        status: status === "all" ? undefined : status,
        page,
        pageSize,
      }),
  });

  const applications = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  useEffect(() => {
    if (data && page > data.totalPages) setPage(data.totalPages);
  }, [data, page]);

  const invalidate = () => {
    onMutated();
  };
  const approveInstructor = useMutation({
    mutationFn: (id: string) => adminApi.approveInstructorApplication(id),
    onSuccess: invalidate,
  });
  const rejectInstructor = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      adminApi.rejectInstructorApplication(id, note),
    onSuccess: (_, { id }) => {
      invalidate();
      const app = applications.find((a) => a.id === id);
      toast("Application rejected", { description: app?.name });
      setRejectingId(null);
      setRejectReason("");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search applications…" className="pl-9" />
        </div>
        <div className="flex gap-1">
          {STATUS_FILTERS.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "default" : "outline"}
              onClick={() => setStatus(s)}
              className="capitalize"
            >
              {s.toLowerCase()}
            </Button>
          ))}
        </div>
        <div className="ml-auto">
          <AdminRowsPerPage value={pageSize} onChange={(v) => setPageSize(v)} />
        </div>
      </div>

      <AdminTableCard className="min-h-0 flex-1" scrollClassName="h-full max-h-none">
        <Table>
          <TableHeader>
            <TableRow className={stickyHeaderRowClass}>
              <TableHead className={`pl-6 ${stickyHeaderCellClass}`}>Applicant</TableHead>
              <TableHead className={stickyHeaderCellClass}>Headline &amp; expertise</TableHead>
              <TableHead className={stickyHeaderCellClass}>Applied</TableHead>
              <TableHead className={stickyHeaderCellClass}>Status</TableHead>
              <TableHead className={`pr-6 ${stickyHeaderCellClass}`} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(5)].map((__, j) => (
                    <TableCell key={j} className={j === 0 ? "pl-6" : j === 4 ? "pr-6" : ""}>
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : applications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No applications found.</TableCell>
              </TableRow>
            ) : (
              applications.map((a) => (
                <ApplicationTableRow
                  key={a.id}
                  app={a}
                  onView={() => setViewingId(a.id)}
                  onApprove={() => {
                    approveInstructor.mutate(a.id);
                    toast.success("Instructor approved 🎉", { description: a.name });
                  }}
                  approving={approveInstructor.isPending && approveInstructor.variables === a.id}
                  onOpenReject={() => setRejectingId(a.id)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </AdminTableCard>

      <div className="shrink-0 pt-2">
        <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <ApplicationDetailDialog
        app={applications.find((a) => a.id === viewingId) ?? null}
        onClose={() => setViewingId(null)}
        onApprove={(a) => {
          approveInstructor.mutate(a.id);
          toast.success("Instructor approved 🎉", { description: a.name });
          setViewingId(null);
        }}
        approving={approveInstructor.isPending}
        onOpenReject={(a) => {
          setViewingId(null);
          setRejectingId(a.id);
        }}
      />

      <Dialog
        open={!!rejectingId}
        onOpenChange={(open) => {
          setRejectingId(open ? rejectingId : null);
          if (!open) setRejectReason("");
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Reject application
              {rejectingId && applications.find((a) => a.id === rejectingId)
                ? ` — ${applications.find((a) => a.id === rejectingId)!.name}`
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Rejection reason</label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this application wasn't approved — the applicant will see this."
                className="min-h-24"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectingId(null)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                className="text-destructive"
                disabled={!rejectReason.trim() || rejectInstructor.isPending}
                onClick={() => rejectingId && rejectInstructor.mutate({ id: rejectingId, note: rejectReason.trim() })}
              >
                <X /> Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ApplicationTableRow({
  app: a,
  onView,
  onApprove,
  approving,
  onOpenReject,
}: {
  app: InstructorApplicationDto;
  onView: () => void;
  onApprove: () => void;
  approving: boolean;
  onOpenReject: () => void;
}) {
  return (
    <TableRow>
      <TableCell className="pl-6">
        <div className="flex items-center gap-3">
          <Avatar className="size-8 ring-1 ring-border">
            <AvatarFallback className="brand-gradient text-xs text-white">{initials(a.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-medium">{a.name}</span>
              {a.cvUrl && <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-label="CV attached" />}
            </div>
            <div className="text-xs text-muted-foreground">{a.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="max-w-64 text-sm text-muted-foreground">
        <div className="truncate">{a.headline}</div>
        <div className="truncate text-xs">{a.expertise}</div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{shortDate(a.appliedAt)}</TableCell>
      <TableCell>{statusBadge[a.status]}</TableCell>
      <TableCell className="pr-6">
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" size="sm" onClick={onView}>
            <Eye className="h-4 w-4" /> View
          </Button>
          {a.status === "PENDING" && (
            <>
              <Button variant="outline" size="sm" onClick={onOpenReject}>
                <X className="h-4 w-4" /> Reject
              </Button>
              <Button size="sm" onClick={onApprove} disabled={approving}>
                <Check className="h-4 w-4" /> Approve
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
