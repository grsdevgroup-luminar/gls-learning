"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useMyPartnerCourseAssignments, useMyPartnerInvitations, useMyPartnerMembers,
} from "@/lib/api/delivery-partner-hooks";
import { partnerApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { relativeDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatStrip, Stat } from "@/components/shared/stat-strip";
import { CollapsibleStats } from "@/components/shared/collapsible-stats";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
import { UserPlus, Search, UserMinus, MailX, Users, CheckCircle2, Clock } from "lucide-react";
import { useDebouncedSearch } from "@/lib/use-debounced-value";
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
  courseAssignmentId: string;
  courseTitle: string;
};

function courseOptionLabel(c: { course: { title: string }; memberCap: number; usedSeats: number }): string {
  const seats = c.memberCap === 0 ? `${c.usedSeats} members` : `${c.usedSeats}/${c.memberCap}`;
  return `${c.course.title} (${seats})`;
}

/** Members granted free course access directly by the partner — the other
 *  of the two enrollment channels on the Members hub (see PurchasesTab).
 *  Aggregates across every course assignment; ManageMembersDialog on the
 *  Courses page covers the same data scoped to one course at a time. */
export function DirectInvitesTab() {
  const qc = useQueryClient();
  const { data: assignments } = useMyPartnerCourseAssignments();
  const { data: members, isLoading: membersLoading } = useMyPartnerMembers();
  const { data: invitations, isLoading: invitesLoading } = useMyPartnerInvitations();
  const isLoading = membersLoading || invitesLoading;

  const [selectedCourse, setSelectedCourse] = useState("");
  const [email, setEmail] = useState("");
  const [qInput, setQInput] = useState("");
  const q = useDebouncedSearch(qInput);
  const [statusFilter, setStatusFilter] = useState<RowStatus | "all">("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(ADMIN_PAGE_SIZE_OPTIONS[0]);

  // Broad prefix invalidation — keeps this aggregate view and the per-course
  // ManageMembersDialog on the Courses page in sync with each other without
  // either one needing to know the other's exact query keys.
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["delivery-partner"] });
    void qc.invalidateQueries({ queryKey: ["me", "delivery-partner"] });
  };

  const inviteMutation = useMutation({
    mutationFn: () => partnerApi.invite(selectedCourse, email.trim()),
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

  const courses = assignments ?? [];
  const selectedAssignment = courses.find((c) => c.id === selectedCourse);
  const seatsFull = !!selectedAssignment && selectedAssignment.memberCap > 0
    && selectedAssignment.usedSeats >= selectedAssignment.memberCap;

  const rows: Row[] = useMemo(() => {
    const memberRows: Row[] = (members ?? []).map((m) => ({
      id: m.id,
      status: "active",
      name: m.name,
      email: m.email,
      date: m.joinedAt,
      courseAssignmentId: m.courseAssignmentId,
      courseTitle: m.courseTitle,
    }));
    const inviteRows: Row[] = (invitations ?? []).map((inv) => ({
      id: inv.id,
      status: "pending",
      name: "",
      email: inv.email,
      date: inv.createdAt,
      courseAssignmentId: inv.courseAssignmentId,
      courseTitle: inv.courseTitle,
    }));
    return [...memberRows, ...inviteRows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [members, invitations]);

  const filtered = useMemo(() => {
    const query = q.toLowerCase();
    return rows
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .filter((r) => courseFilter === "all" || r.courseAssignmentId === courseFilter)
      .filter((r) => !query || r.name.toLowerCase().includes(query) || r.email.toLowerCase().includes(query));
  }, [rows, q, statusFilter, courseFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [q, statusFilter, courseFilter, pageSize]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Lifetime count — sums each course assignment's totalInvitesSent, which
  // only ever increments (see its doc comment), so revoking a member or an
  // invite expiring/being cancelled never reduces this, unlike rows.length
  // which reflects only currently-active/pending rows.
  const totalInvited = (assignments ?? []).reduce((sum, a) => sum + a.totalInvitesSent, 0);

  const activeCount = members?.length ?? 0;
  const pendingCount = invitations?.length ?? 0;

  return (
    <div className="space-y-4">
      <CollapsibleStats
        summary={`${totalInvited} invited · ${activeCount} active · ${pendingCount} pending`}
      >
        <StatStrip className="grid-cols-3">
          <Stat icon={Users} label="Total invited" value={totalInvited} tint="var(--tint-indigo)" />
          <Stat icon={CheckCircle2} label="Active" value={activeCount} tint="var(--tint-emerald)" />
          <Stat icon={Clock} label="Pending" value={pendingCount} tint="var(--tint-amber)" />
        </StatStrip>
      </CollapsibleStats>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!selectedCourse) return toast.error("Pick a course first");
          if (!email.trim()) return;
          if (seatsFull) return toast.error("No seats remaining for this course");
          inviteMutation.mutate();
        }}
      >
        <Select value={selectedCourse} onValueChange={(v) => v && setSelectedCourse(v)}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Choose a course">
              {(value: string) => {
                const c = courses.find((x) => x.id === value);
                return c ? courseOptionLabel(c) : "Choose a course";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="w-max min-w-[280px] max-w-[26rem]">
            {courses.map((c) => (
              <SelectItem
                key={c.id}
                value={c.id}
                disabled={c.memberCap > 0 && c.usedSeats >= c.memberCap}
              >
                {courseOptionLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="email"
          placeholder="member@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={!selectedCourse || seatsFull}
        />
        <Button type="submit" disabled={inviteMutation.isPending || !selectedCourse || seatsFull || !email.trim()}>
          <UserPlus className="h-4 w-4" /> Invite
        </Button>
      </form>
      {seatsFull && (
        <p className="text-xs text-warning">This course is full — ask an admin to raise the cap.</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-1 sm:flex-row">
          <div className="relative sm:max-w-xs sm:flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search by name or email…"
              className="search-input border-input bg-background pl-9 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:bg-input/30"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v as RowStatus | "all")}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue>
                {(value: RowStatus | "all") => (value === "all" ? "All statuses" : statusStyle[value].label)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">{statusStyle.active.label}</SelectItem>
              <SelectItem value="pending">{statusStyle.pending.label}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={courseFilter} onValueChange={(v) => v && setCourseFilter(v)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue>
                {(value: string) => (value === "all" ? "All courses" : (courses.find((c) => c.id === value)?.course.title ?? "All courses"))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="w-max min-w-[200px] max-w-[26rem]">
              <SelectItem value="all">All courses</SelectItem>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.course.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <AdminRowsPerPage value={pageSize} onChange={setPageSize} />
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 w-full animate-pulse rounded bg-muted" />
            ))}
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No members yet — invite someone above.
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No members match this search/filter.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="space-y-3 sm:hidden">
            {paged.map((r) => (
              <Card key={r.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {r.name && <div className="truncate text-sm font-medium">{r.name}</div>}
                      <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                      <div className="truncate text-xs text-muted-foreground">{r.courseTitle}</div>
                    </div>
                    <Badge variant="outline" className={`shrink-0 ${statusStyle[r.status].className}`}>
                      {statusStyle[r.status].label}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">
                      {r.status === "active" ? `Joined ${relativeDate(r.date)}` : `Invited ${relativeDate(r.date)}`}
                    </span>
                    {r.status === "active" ? (
                      <ConfirmDialog
                        trigger={
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive">
                            <UserMinus className="h-3 w-3" /> Remove
                          </Button>
                        }
                        title={`Remove ${r.name || r.email}?`}
                        description="They'll lose access to this course right away. Their seat stays used — it won't free up a spot for someone else."
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block">
            <AdminTableCard scrollClassName="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className={stickyHeaderRowClass}>
                    <TableHead className={stickyHeaderCellClass}>Member</TableHead>
                    <TableHead className={stickyHeaderCellClass}>Course</TableHead>
                    <TableHead className={stickyHeaderCellClass}>Status</TableHead>
                    <TableHead className={stickyHeaderCellClass}>Date</TableHead>
                    <TableHead className={stickyHeaderCellClass}></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="min-w-0">
                          {r.name && <div className="truncate font-medium">{r.name}</div>}
                          <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.courseTitle}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusStyle[r.status].className}>
                          {statusStyle[r.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.status === "active" ? `Joined ${relativeDate(r.date)}` : `Invited ${relativeDate(r.date)}`}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "active" ? (
                          <ConfirmDialog
                            trigger={
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive">
                                <UserMinus className="h-3 w-3" /> Remove
                              </Button>
                            }
                            title={`Remove ${r.name || r.email}?`}
                            description="They'll lose access to this course right away. Their seat stays used — it won't free up a spot for someone else."
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
                  ))}
                </TableBody>
              </Table>
            </AdminTableCard>
          </div>
        </>
      )}

      <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} total={filtered.length} itemLabel="member" />
    </div>
  );
}
