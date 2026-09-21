"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { partnerApi } from "@/lib/api/endpoints";
import type { DeliveryPartnerCourseAssignmentDto } from "@skillstream/shared";
import { getApiErrorMessage } from "@/lib/api/errors";
import { relativeDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AdminPagination, AdminRowsPerPage, ADMIN_PAGE_SIZE_OPTIONS,
} from "@/app/admin/_components/admin-pagination";
import {
  AdminTableCard, stickyHeaderCellClass, stickyHeaderRowClass,
} from "@/app/admin/_components/admin-table";
import { UserPlus, Users, Search, Info, UserMinus, MailX } from "lucide-react";
import { toast } from "sonner";

type RowStatus = "active" | "pending";

const statusStyle: Record<RowStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "text-success" },
  pending: { label: "Pending", className: "text-warning" },
};

type Row = {
  id: string;
  status: RowStatus;
  name: string;
  email: string;
  date: string;
};

/**
 * Per-course-assignment member/invite management — a delivery partner's
 * equivalent of the org members page, scoped one level deeper (one course,
 * not the whole partner) since access is per-course (see
 * DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §3/§6).
 */
export function ManageMembersDialog({
  assignment,
}: {
  assignment: DeliveryPartnerCourseAssignmentDto;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RowStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(ADMIN_PAGE_SIZE_OPTIONS[0]);

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["delivery-partner", "courses", assignment.id, "members"],
    queryFn: () => partnerApi.members(assignment.id),
    enabled: open,
  });
  const { data: invitations, isLoading: invitesLoading } = useQuery({
    queryKey: ["delivery-partner", "courses", assignment.id, "invitations"],
    queryFn: () => partnerApi.invitations(assignment.id),
    enabled: open,
  });
  const isLoading = membersLoading || invitesLoading;

  // Broad prefix invalidation — also busts the partner-wide "Direct invites"
  // tab on the Members hub page, which aggregates this same data across
  // every course assignment (see delivery-partner/referrals/_components/
  // direct-invites-tab.tsx), so both views stay in sync.
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["delivery-partner"] });
    void qc.invalidateQueries({ queryKey: ["me", "delivery-partner"] });
  };

  const inviteMutation = useMutation({
    mutationFn: () => partnerApi.invite(assignment.id, email.trim()),
    onSuccess: () => {
      toast.success(`Invited ${email}`, { description: "They'll get access when they accept." });
      setEmail("");
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => partnerApi.revokeInvitation(inviteId),
    onSuccess: () => { toast.success("Invitation revoked"); invalidate(); },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
  const removeMutation = useMutation({
    mutationFn: (memberId: string) => partnerApi.removeMember(memberId),
    onSuccess: () => { toast.success("Member removed"); invalidate(); },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const unlimited = assignment.memberCap === 0;
  const seatsFull = !unlimited && assignment.usedSeats >= assignment.memberCap;

  const rows: Row[] = useMemo(() => {
    const memberRows: Row[] = (members ?? []).map((m) => ({
      id: m.id, status: "active", name: m.name, email: m.email, date: m.joinedAt,
    }));
    const inviteRows: Row[] = (invitations ?? []).map((inv) => ({
      id: inv.id, status: "pending", name: "", email: inv.email, date: inv.createdAt,
    }));
    return [...memberRows, ...inviteRows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [members, invitations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  }, [rows, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [search, statusFilter, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) { setEmail(""); setSearch(""); setStatusFilter("all"); setPage(1); }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
        <Users className="h-3.5 w-3.5" />
        {unlimited ? `${assignment.usedSeats} members` : `${assignment.usedSeats}/${assignment.memberCap} members`}
      </DialogTrigger>
      <DialogContent className="flex h-[min(700px,calc(100vh-2rem))] w-[calc(100vw-2rem)] !max-w-none flex-col sm:w-[min(760px,calc(100vw-3rem))] sm:min-w-[640px]">
        <DialogHeader>
          <div className="flex items-center gap-1.5">
            <DialogTitle>{assignment.course.title} — members</DialogTitle>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"
                    aria-label="About members"
                  />
                }
              >
                <Info className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-left leading-relaxed" side="bottom" align="start">
                Invite people by email to give them free access to this course. They get an email with a
                claim link and take up a seat once they accept — remove a member or revoke a pending
                invitation any time to free up their seat.
              </TooltipContent>
            </Tooltip>
            <Badge variant="outline" className="ml-1">
              {unlimited ? `${assignment.usedSeats} members · unlimited seats` : `${assignment.usedSeats}/${assignment.memberCap} seats used`}
            </Badge>
          </div>
        </DialogHeader>

        <form
          className="flex shrink-0 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.trim()) return;
            if (seatsFull) {
              toast.error("No seats remaining for this course");
              return;
            }
            inviteMutation.mutate();
          }}
        >
          <Input
            type="email"
            placeholder="member@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={seatsFull}
          />
          <Button type="submit" disabled={inviteMutation.isPending || seatsFull || !email.trim()}>
            <UserPlus className="h-4 w-4" /> Invite
          </Button>
        </form>
        {seatsFull && (
          <p className="shrink-0 text-xs text-warning">This course is full — remove a member or ask an admin to raise the cap.</p>
        )}

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="search-input h-9 border-input bg-background pl-8 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:bg-input/30"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v as RowStatus | "all")}>
            <SelectTrigger className="h-9 w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">{statusStyle.active.label}</SelectItem>
              <SelectItem value="pending">{statusStyle.pending.label}</SelectItem>
            </SelectContent>
          </Select>
          <AdminRowsPerPage value={pageSize} onChange={setPageSize} />
        </div>

        <AdminTableCard className="min-h-0 flex-1" scrollClassName="h-full max-h-none">
          <Table>
            <TableHeader>
              <TableRow className={stickyHeaderRowClass}>
                <TableHead className={`pl-4 ${stickyHeaderCellClass}`}>Member</TableHead>
                <TableHead className={stickyHeaderCellClass}>Status</TableHead>
                <TableHead className={stickyHeaderCellClass}>Date</TableHead>
                <TableHead className={`pr-4 ${stickyHeaderCellClass}`}></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <TableCell key={j} className={j === 0 ? "pl-4" : j === 3 ? "pr-4" : ""}>
                        <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    No members yet — invite someone above.
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    No members match this search/filter.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-4">
                      <div className="min-w-0">
                        {r.name && <div className="truncate font-medium">{r.name}</div>}
                        <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusStyle[r.status].className}>
                        {statusStyle[r.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.status === "active" ? `Joined ${relativeDate(r.date)}` : `Invited ${relativeDate(r.date)}`}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      {r.status === "active" ? (
                        <ConfirmDialog
                          trigger={
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive">
                              <UserMinus className="h-3 w-3" /> Remove
                            </Button>
                          }
                          title={`Remove ${r.name || r.email}?`}
                          description="They'll lose access to this course right away, freeing up their seat."
                          confirmLabel="Remove"
                          pending={removeMutation.isPending}
                          onConfirm={() => removeMutation.mutate(r.id)}
                        />
                      ) : (
                        <ConfirmDialog
                          trigger={
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive">
                              <MailX className="h-3 w-3" /> Revoke
                            </Button>
                          }
                          title={`Revoke invitation to ${r.email}?`}
                          description="They won't be able to accept this invite anymore."
                          confirmLabel="Revoke"
                          pending={revokeMutation.isPending}
                          onConfirm={() => revokeMutation.mutate(r.id)}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </AdminTableCard>

        <div className="shrink-0">
          <AdminPagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            total={filtered.length}
            itemLabel="member"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
