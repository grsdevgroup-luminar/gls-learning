"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { adminApi, type DeliveryPartnerApplicationDto } from "@/lib/api/endpoints";
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
import { Check, X, Eye, Search, FileText, Globe2 } from "lucide-react";
import { toast } from "sonner";
import { initials } from "@/lib/format";
import { flagFor } from "@skillstream/shared";
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
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveCommission, setApproveCommission] = useState("10");
  const [approveNote, setApproveNote] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);

  useEffect(() => setPage(1), [q, status, pageSize]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "delivery-partner-applications", { q, status, page, pageSize }],
    queryFn: () =>
      adminApi.deliveryPartnerApplications({
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

  const invalidate = () => onMutated();

  const approvePartner = useMutation({
    mutationFn: ({ id, commissionPercent, note }: { id: string; commissionPercent: number; note?: string }) =>
      adminApi.approveDeliveryPartnerApplication(id, commissionPercent, note),
    onSuccess: (_, { id }) => {
      invalidate();
      const app = applications.find((a) => a.id === id);
      toast.success("Delivery partner approved 🎉", { description: app?.name });
      setApprovingId(null);
      setApproveCommission("10");
      setApproveNote("");
      setViewingId(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const rejectPartner = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      adminApi.rejectDeliveryPartnerApplication(id, note),
    onSuccess: (_, { id }) => {
      invalidate();
      const app = applications.find((a) => a.id === id);
      toast("Application rejected", { description: app?.name });
      setRejectingId(null);
      setRejectReason("");
      setViewingId(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const approvingApp = applications.find((a) => a.id === approvingId);
  const rejectingApp = applications.find((a) => a.id === rejectingId);
  const commissionValue = Number(approveCommission);
  const commissionValid = commissionValue >= 1 && commissionValue <= 50;

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search applications…" className="search-input border-input bg-background pl-9 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:bg-input/30" />
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
              <TableHead className={stickyHeaderCellClass}>Country</TableHead>
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
                  onOpenApprove={() => {
                    setApproveCommission(a.expectedCommissionPercent != null ? String(a.expectedCommissionPercent) : "10");
                    setApprovingId(a.id);
                  }}
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
        onOpenApprove={(a) => {
          setApproveCommission(a.expectedCommissionPercent != null ? String(a.expectedCommissionPercent) : "10");
          setApprovingId(a.id);
        }}
        onOpenReject={(a) => setRejectingId(a.id)}
      />

      <Dialog
        open={!!approvingId}
        onOpenChange={(open) => {
          setApprovingId(open ? approvingId : null);
          if (!open) { setApproveCommission("10"); setApproveNote(""); }
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm overflow-hidden">
          <DialogHeader>
            <DialogTitle className="wrap-break-words pr-8 leading-snug">
              Approve — {approvingApp?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 w-full space-y-4">
            <div className="space-y-1">
              <label htmlFor="partner-commission" className="text-sm font-medium">Commission %</label>
              <Input
                id="partner-commission"
                type="number"
                min={1}
                max={50}
                step="0.01"
                value={approveCommission}
                onChange={(e) => setApproveCommission(e.target.value)}
              />
              {approvingApp?.expectedCommissionPercent != null && (
                <p className="text-xs text-muted-foreground">Applicant requested {approvingApp.expectedCommissionPercent}%.</p>
              )}
            </div>
            <div className="space-y-1">
              <label htmlFor="partner-approve-note" className="text-sm font-medium">Note (optional)</label>
              <Input
                id="partner-approve-note"
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="Internal note…"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setApprovingId(null)}>Cancel</Button>
              <Button
                disabled={!commissionValid || approvePartner.isPending}
                onClick={() =>
                  approvingId &&
                  approvePartner.mutate({
                    id: approvingId,
                    commissionPercent: commissionValue,
                    note: approveNote.trim() || undefined,
                  })
                }
              >
                <Check className="h-4 w-4" /> Approve
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!rejectingId}
        onOpenChange={(open) => {
          setRejectingId(open ? rejectingId : null);
          if (!open) setRejectReason("");
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg overflow-hidden">
          <DialogHeader>
            <DialogTitle className="wrap-break-words pr-8 leading-snug">
              Reject application{rejectingApp ? ` — ${rejectingApp.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 w-full space-y-4">
            <div className="space-y-1">
              <label htmlFor="partner-rejection-reason" className="text-sm font-medium">Rejection reason</label>
              <Textarea
                id="partner-rejection-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this application wasn't approved — the applicant will see this."
                className="min-h-24 w-full resize-y"
              />
            </div>
            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setRejectingId(null)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                className="w-full text-destructive sm:w-auto"
                disabled={!rejectReason.trim() || rejectPartner.isPending}
                onClick={() => rejectingId && rejectPartner.mutate({ id: rejectingId, note: rejectReason.trim() })}
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
  onOpenApprove,
  onOpenReject,
}: {
  app: DeliveryPartnerApplicationDto;
  onView: () => void;
  onOpenApprove: () => void;
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
              {a.documents.length > 0 && <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-label="Documents attached" />}
            </div>
            <div className="text-xs text-muted-foreground">{a.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {a.country ? <span className="inline-flex items-center gap-1.5"><Globe2 className="size-3.5" /> {flagFor(a.country)} {a.country}</span> : "—"}
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
              <Button size="sm" onClick={onOpenApprove}>
                <Check className="h-4 w-4" /> Approve
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
