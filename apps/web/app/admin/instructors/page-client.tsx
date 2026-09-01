"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type InstructorApplicationDto, type InstructorProfileDto } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useCategories } from "@/lib/api/hooks";
import { useDebouncedSearch } from "@/lib/use-debounced-value";
import { cn } from "@/lib/utils";
import { StatStrip, Stat } from "@/components/shared/stat-strip";
import { Stars } from "@/components/shared/stars";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock, Users, GraduationCap, CheckCircle2, Check, X, ExternalLink, Mail,
  Search, XCircle, Eye, Calendar, FileText, Download,
} from "lucide-react";
import { toast } from "sonner";
import { initials, compactNumber, relativeDate } from "@/lib/format";
import {
  AdminPagination,
  AdminRowsPerPage,
  ADMIN_PAGE_SIZE_OPTIONS,
} from "../_components/admin-pagination";
import {
  AdminTableCard,
  stickyHeaderCellClass,
  stickyHeaderRowClass,
} from "../_components/admin-table";

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const STATUS_FILTERS = ["all", "PENDING", "APPROVED", "REJECTED"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export default function AdminInstructors() {
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["admin", "instructor-application-stats"],
    queryFn: () => adminApi.instructorApplicationStats(),
  });

  return (
    <div className="flex h-screen flex-col space-y-6 p-6 md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Instructors</h1>
        <p className="text-muted-foreground">Review applications and manage your teaching roster.</p>
      </div>

      <Tabs defaultValue="applications" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="shrink-0">
          <TabsTrigger value="applications">
            Applications
            {!!stats?.pending && (
              <Badge variant="outline" className="ml-1.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] text-warning border-warning/30 bg-warning/10">
                {stats.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="roster">Active instructors</TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
          <StatStrip className="grid-cols-2 shrink-0 lg:grid-cols-3">
            <Stat icon={Clock} label="Pending applications" value={stats?.pending ?? "—"} tint="var(--tint-amber)" />
            <Stat icon={CheckCircle2} label="Approved applications" value={stats?.approved ?? "—"} tint="var(--tint-emerald)" />
            <Stat icon={XCircle} label="Rejected" value={stats?.rejected ?? "—"} tint="var(--tint-rose)" />
          </StatStrip>
          <ApplicationsTab
            onMutated={() => {
              qc.invalidateQueries({ queryKey: ["admin", "instructor-applications"] });
              qc.invalidateQueries({ queryKey: ["admin", "instructor-application-stats"] });
              qc.invalidateQueries({ queryKey: ["admin", "instructor-roster"] });
            }}
          />
        </TabsContent>

        <TabsContent value="roster" className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
          <RosterTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ApplicationsTab({ onMutated }: { onMutated: () => void }) {
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

const statusBadge = {
  PENDING: <Badge variant="outline" className="gap-1 text-warning border-warning/30 bg-warning/10"><Clock className="size-3" /> Pending</Badge>,
  APPROVED: <Badge variant="outline" className="gap-1 text-success border-success/30 bg-success/10"><CheckCircle2 className="size-3" /> Approved</Badge>,
  REJECTED: <Badge variant="outline" className="gap-1 text-destructive border-destructive/30 bg-destructive/10"><X className="size-3" /> Rejected</Badge>,
} as const;

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

function ApplicationDetailDialog({
  app: a,
  onClose,
  onApprove,
  approving,
  onOpenReject,
}: {
  app: InstructorApplicationDto | null;
  onClose: () => void;
  onApprove: (app: InstructorApplicationDto) => void;
  approving: boolean;
  onOpenReject: (app: InstructorApplicationDto) => void;
}) {
  const links = a
    ? [
        { url: a.sampleUrl, label: "Sample / portfolio" },
        { url: a.linkedinUrl, label: "LinkedIn" },
        { url: a.twitterUrl, label: "Twitter / X" },
        { url: a.youtubeUrl, label: "YouTube" },
        { url: a.facebookUrl, label: "Facebook" },
        { url: a.otherUrl, label: "Other link" },
      ].filter((l) => l.url)
    : [];

  return (
    <Dialog open={!!a} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl sm:max-w-2xl">
        {a && (
          <>
            <DialogHeader>
              <DialogTitle className="sr-only">Application — {a.name}</DialogTitle>
            </DialogHeader>
            <div className="flex items-start gap-3">
              <Avatar className="size-12 ring-1 ring-border">
                <AvatarFallback className="brand-gradient text-sm text-white">{initials(a.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold">{a.name}</span>
                  {statusBadge[a.status]}
                </div>
                <p className="text-sm text-muted-foreground">{a.headline}</p>
              </div>
            </div>

            <div
              className={cn(
                "mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm",
                // Reserving a 4th column when there's no Reviewed date to fill it
                // starves Email of width it doesn't need to give up — only go to
                // 4 columns once something actually occupies the 4th slot.
                a.reviewedAt ? "sm:grid-cols-4" : "sm:grid-cols-3",
              )}
            >
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="flex items-start gap-1.5">
                  <Mail className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="break-words">{a.email}</span>
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Expertise</div>
                <div className="break-words">{a.expertise}</div>
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Applied</div>
                <div className="inline-flex items-center gap-1.5"><Calendar className="size-3.5 shrink-0 text-muted-foreground" /> {shortDate(a.appliedAt)}</div>
              </div>
              {a.reviewedAt && (
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Reviewed</div>
                  <div className="inline-flex items-center gap-1.5"><Calendar className="size-3.5 shrink-0 text-muted-foreground" /> {shortDate(a.reviewedAt)}</div>
                </div>
              )}
            </div>

            <div className="mt-4">
              <div className="text-xs text-muted-foreground">About</div>
              <p className="mt-1 text-sm leading-relaxed">{a.bio}</p>
            </div>

            {a.cvUrl && (
              <div className="mt-4">
                <div className="text-xs text-muted-foreground">Résumé / CV</div>
                <a
                  href={a.cvUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm hover:bg-muted"
                >
                  <FileText className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate">{a.cvName ?? "CV"}</span>
                  {a.cvSizeLabel && <span className="shrink-0 text-xs text-muted-foreground">{a.cvSizeLabel}</span>}
                  <Download className="size-3.5 shrink-0 text-muted-foreground" />
                </a>
              </div>
            )}

            {links.length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-muted-foreground">Links</div>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {links.map((l) => (
                    <a
                      key={l.label}
                      href={l.url!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="size-3" /> {l.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {a.note && (
              <div className="mt-4">
                <div className="text-xs text-muted-foreground">Review note</div>
                <p className="mt-1 text-sm leading-relaxed">{a.note}</p>
              </div>
            )}

            {a.status === "PENDING" && (
              <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
                <Button variant="outline" className="text-destructive" onClick={() => onOpenReject(a)}>
                  <X /> Reject
                </Button>
                <Button onClick={() => onApprove(a)} disabled={approving}>
                  <Check /> Approve
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RosterTab() {
  const [qInput, setQInput] = useState("");
  const q = useDebouncedSearch(qInput);
  const [expertise, setExpertise] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(ADMIN_PAGE_SIZE_OPTIONS[0]);
  const { data: categories = [] } = useCategories();

  useEffect(() => setPage(1), [q, expertise, pageSize]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "instructor-roster", { q, expertise, page, pageSize }],
    queryFn: () =>
      adminApi.instructors({
        q: q || undefined,
        expertise: expertise === "all" ? undefined : expertise,
        page,
        pageSize,
      }),
  });

  const roster = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalStudents = roster.reduce((s, i) => s + i.studentCount, 0);

  useEffect(() => {
    if (data && page > data.totalPages) setPage(data.totalPages);
  }, [data, page]);

  return (
    <>
      <StatStrip className="grid-cols-1 shrink-0 sm:grid-cols-2">
        <Stat icon={GraduationCap} label="Active instructors" value={data?.total ?? "—"} tint="var(--tint-indigo)" />
        <Stat icon={Users} label="Students on this page" value={compactNumber(totalStudents)} tint="var(--tint-sky)" />
      </StatStrip>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search instructors…" className="pl-9" />
        </div>
        <Select value={expertise} onValueChange={(v) => v && setExpertise(v)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All expertise</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <AdminRowsPerPage value={pageSize} onChange={(v) => setPageSize(v)} />
        </div>
      </div>

      <AdminTableCard className="min-h-0 flex-1" scrollClassName="h-full max-h-none">
        <Table>
          <TableHeader>
            <TableRow className={stickyHeaderRowClass}>
              <TableHead className={`pl-6 ${stickyHeaderCellClass}`}>Instructor</TableHead>
              <TableHead className={stickyHeaderCellClass}>Headline</TableHead>
              <TableHead className={stickyHeaderCellClass}>Courses</TableHead>
              <TableHead className={stickyHeaderCellClass}>Students</TableHead>
              <TableHead className={stickyHeaderCellClass}>Rating</TableHead>
              <TableHead className={`pr-6 ${stickyHeaderCellClass}`}>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(6)].map((__, j) => (
                    <TableCell key={j} className={j === 0 ? "pl-6" : j === 5 ? "pr-6" : ""}>
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : roster.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No instructors found.</TableCell>
              </TableRow>
            ) : (
              roster.map((i: InstructorProfileDto) => (
                <TableRow key={i.userId}>
                  <TableCell className="pl-6">
                    <Link href={`/instructors/${i.userId}`} target="_blank" className="flex items-center gap-3 hover:underline">
                      <Avatar className="size-8 ring-1 ring-border">
                        <AvatarFallback className="brand-gradient text-xs text-white">{initials(i.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{i.name}</div>
                        <div className="text-xs text-muted-foreground">{i.email}</div>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-sm text-muted-foreground">{i.title || "—"}</TableCell>
                  <TableCell>{i.courseCount}</TableCell>
                  <TableCell>{compactNumber(i.studentCount)}</TableCell>
                  <TableCell>{i.ratingAvg > 0 ? <Stars rating={i.ratingAvg} size={12} showValue /> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="pr-6 text-sm text-muted-foreground">{i.joinedAt ? relativeDate(i.joinedAt) : "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </AdminTableCard>

      <div className="shrink-0 pt-2">
        <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </>
  );
}
