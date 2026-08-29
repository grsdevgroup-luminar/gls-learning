"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, type AdminStudentDto, type AdminStudentProfileDto } from "@/lib/api/endpoints";
import { initials, formatUsd } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Users, UserCheck, AlertTriangle, Eye, Mail, Phone, CalendarDays, Flame, Award, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useDebouncedSearch } from "@/lib/use-debounced-value";
import { flagFor, formatCountry } from "@/lib/countries";
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

type StatusKey = "ACTIVE" | "IDLE" | "AT_RISK";

const statusBadge: Record<StatusKey, { label: string; cls: string }> = {
  ACTIVE: { label: "Active", cls: "text-success" },
  IDLE: { label: "Idle", cls: "text-warning" },
  AT_RISK: { label: "At risk", cls: "text-destructive" },
};

export default function AdminStudents() {
  const [qInput, setQInput] = useState("");
  const q = useDebouncedSearch(qInput);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(ADMIN_PAGE_SIZE_OPTIONS[0]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const qc = useQueryClient();

  // Reset to the first page after the debounced query changes.
  useEffect(() => {
    setPage(1);
  }, [q]);

  const { data: studentPage, isLoading, error } = useQuery({
    queryKey: ["admin", "students", q, page, pageSize],
    queryFn: () => adminApi.students({ q: q || undefined, page, pageSize }),
  });
  const { data: statsData } = useQuery({
    queryKey: ["admin", "students", "stats"],
    queryFn: adminApi.studentStats,
  });
  const { data: selectedStudent, isLoading: isProfileLoading, error: profileError } = useQuery({
    queryKey: ["admin", "student-profile", selectedStudentId],
    queryFn: () => adminApi.studentProfile(selectedStudentId!),
    enabled: Boolean(selectedStudentId),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => adminApi.updateUserStatus(id, "AT_RISK"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
      if (suspendMutation.variables) {
        qc.invalidateQueries({ queryKey: ["admin", "student-profile", suspendMutation.variables] });
      }
      toast.success("Student status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  const list = studentPage?.items ?? [];
  const totalPages = studentPage?.totalPages ?? 1;

  useEffect(() => {
    if (studentPage && page > studentPage.totalPages) setPage(studentPage.totalPages);
  }, [studentPage, page]);

  const stats = statsData
    ? [
        { icon: Users, label: "Total students", value: statsData.total },
        { icon: UserCheck, label: "Active", value: statsData.active },
        { icon: AlertTriangle, label: "At risk / idle", value: statsData.atRisk },
      ]
    : [];

  return (
    <div className="space-y-6 p-6 md:p-8 flex flex-col h-screen lg:overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Students</h1>
        <p className="text-muted-foreground">Monitor engagement and re-activate at-risk learners.</p>
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4 shrink-0">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-3 pt-6">
                <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
                <div className="space-y-1.5">
                  <div className="h-7 w-12 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 shrink-0">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3 pt-6">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold leading-none">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Search and Rows per page controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search students…"
            className="pl-9"
          />
        </div>
        <AdminRowsPerPage
          value={pageSize}
          onChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive shrink-0">Failed to load students.</p>
      )}

      <AdminTableCard className="min-h-0 flex-1" scrollClassName="h-full max-h-none">
          <Table>
            <TableHeader>
              <TableRow className={stickyHeaderRowClass}>
                <TableHead className={`pl-6 ${stickyHeaderCellClass}`}>Student</TableHead>
                <TableHead className={stickyHeaderCellClass}>Country</TableHead>
                <TableHead className={stickyHeaderCellClass}>Courses</TableHead>
                <TableHead className={stickyHeaderCellClass}>Total spent</TableHead>
                <TableHead className={stickyHeaderCellClass}>Joined</TableHead>
                <TableHead className={stickyHeaderCellClass}>Status</TableHead>
                <TableHead className={`pr-6 ${stickyHeaderCellClass}`}></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(7)].map((__, j) => (
                        <TableCell key={j} className={j === 0 ? "pl-6" : j === 6 ? "pr-6" : ""}>
                          <div className="h-4 w-full animate-pulse rounded bg-muted" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : list.map((s) => (
                    <StudentRow
                      key={s.id}
                      student={s}
                      onViewProfile={() => setSelectedStudentId(s.id)}
                      onSuspend={() => suspendMutation.mutate(s.id)}
                      suspending={suspendMutation.isPending && suspendMutation.variables === s.id}
                    />
                  ))}
            </TableBody>
          </Table>
      </AdminTableCard>

      {/* Footer Pagination */}
      {studentPage && (
        <div className="shrink-0 pt-2">
          <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      <StudentProfileDialog
        student={selectedStudent}
        open={Boolean(selectedStudentId)}
        loading={isProfileLoading}
        error={profileError}
        onOpenChange={(open) => {
          if (!open) setSelectedStudentId(null);
        }}
      />
    </div>
  );
}

function StudentRow({
  student,
  onViewProfile,
  onSuspend,
  suspending,
}: {
  student: AdminStudentDto;
  onViewProfile: () => void;
  onSuspend: () => void;
  suspending: boolean;
}) {
  const badge = statusBadge[student.status as StatusKey] ?? { label: student.status, cls: "" };
  const isAtRisk = student.status === "AT_RISK";

  return (
    <TableRow className={isAtRisk ? "bg-destructive/5" : ""}>
      <TableCell className="pl-6">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="text-xs">{initials(student.name)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{student.name}</div>
            <div className="text-xs text-muted-foreground">{student.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-sm">
        {student.country ? (
          <span className="inline-flex items-center gap-1.5">
            <span>{flagFor(student.country)}</span>
            {formatCountry(student.country)}
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell>{student.enrollments}</TableCell>
      <TableCell className="text-sm">{formatUsd(student.totalSpentCents / 100).replace(".00", "")}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {new Date(student.joinedAt).toLocaleDateString()}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={badge.cls}>{badge.label}</Badge>
      </TableCell>
      <TableCell className="pr-6 text-right">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onViewProfile}>
            <Eye className="h-4 w-4" /> View profile
          </Button>
          {student.status !== "AT_RISK" && (
            <Button variant="outline" size="sm" onClick={onSuspend} disabled={suspending}>
              Flag at risk
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function StudentProfileDialog({
  student, open, loading, error, onOpenChange,
}: {
  student: AdminStudentProfileDto | undefined;
  open: boolean;
  loading: boolean;
  error: unknown;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="student-profile-dialog flex max-h-[min(760px,calc(100vh-2rem))] w-[calc(100vw-2rem)] !max-w-none flex-col overflow-visible sm:w-[min(760px,calc(100vw-3rem))] sm:min-w-[680px]">
        <DialogHeader>
          <DialogTitle>Student profile</DialogTitle>
          <DialogDescription>Contact details, learning interests, and engagement overview.</DialogDescription>
        </DialogHeader>
        <div className="student-profile-scroll min-h-0 flex-1 overflow-auto pr-1">
          {loading ? <ProfileSkeleton /> : error ? (
            <p className="py-8 text-sm text-destructive">Failed to load this student profile.</p>
          ) : student ? <ProfileDetails student={student} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProfileDetails({ student }: { student: AdminStudentProfileDto }) {
  const badge = statusBadge[student.status as StatusKey] ?? { label: student.status, cls: "" };
  const interests = [...student.interests.categories, ...student.interests.keywords];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
        <Avatar className="h-16 w-16">
          {student.avatar && <AvatarImage src={student.avatar} alt="" />}
          <AvatarFallback className="brand-gradient text-lg text-white">{initials(student.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{student.name}</h3>
            <Badge variant="outline" className={badge.cls}>{badge.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{student.email}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info icon={Mail} label="Email" value={student.email} />
        <Info icon={Phone} label="Phone" value={student.phone ?? "Not provided"} />
        <Info icon={CalendarDays} label="Joined" value={formatDate(student.joinedAt)} />
        <Info icon={CalendarDays} label="Last activity" value={student.lastActivityAt ? formatDate(student.lastActivityAt) : "No activity yet"} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric icon={BookOpen} label="Courses" value={student.enrollments} />
        <Metric icon={Award} label="Completed" value={student.completedCourses} />
        <Metric icon={Award} label="Certificates" value={student.certificates} />
        <Metric icon={Flame} label="Streak" value={`${student.streakDays} days`} />
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Profile details</h3>
        <div className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-2">
          <InfoRow label="Country" value={student.country ? `${flagFor(student.country)} ${formatCountry(student.country)}` : "Not provided"} />
          <InfoRow label="Total spent" value={formatUsd(student.totalSpentCents / 100).replace(".00", "")} />
          <InfoRow label="Interests" value={interests.length ? interests.join(", ") : "Not completed"} />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Course progress</h3>
        {student.courses.length ? <div className="space-y-2">
          {student.courses.map((course) => (
            <div key={course.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{course.title}</span>
                <span className="shrink-0 font-semibold tabular-nums">{course.progressPct}%</span>
              </div>
              <Progress value={course.progressPct} className="mt-2 h-1.5" />
              <p className="mt-2 text-xs text-muted-foreground">
                {course.completedLessons}/{course.totalLessons} lessons · {course.status === "COMPLETED" ? `Completed ${formatDate(course.completedAt ?? course.lastActivityAt)}` : `Last active ${formatDate(course.lastActivityAt)}`}
                {course.certificateIssuedAt ? " · Certificate issued" : ""}
              </p>
            </div>
          ))}
        </div> : <p className="rounded-lg border p-4 text-sm text-muted-foreground">No course enrollments yet.</p>}
      </section>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return <div className="rounded-lg border p-3"><Icon className="mb-2 h-4 w-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">{label}</p><p className="truncate text-sm font-medium" title={value}>{value}</p></div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: string | number }) {
  return <div className="rounded-lg border p-3"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-xs">{label}</span></div><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div><span className="text-xs text-muted-foreground">{label}</span><p className="mt-0.5 text-sm">{value}</p></div>;
}

function ProfileSkeleton() {
  return <div className="space-y-4 py-2">{["h-20", "h-24", "h-32", "h-44"].map((height) => <div key={height} className={`animate-pulse rounded-lg bg-muted ${height}`} />)}</div>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
}
