"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, type AdminStudentDto } from "@/lib/api/endpoints";
import { initials, formatUsd } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Users, UserCheck, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type StatusKey = "ACTIVE" | "IDLE" | "AT_RISK";

const statusBadge: Record<StatusKey, { label: string; cls: string }> = {
  ACTIVE: { label: "Active", cls: "text-success" },
  IDLE: { label: "Idle", cls: "text-warning" },
  AT_RISK: { label: "At risk", cls: "text-destructive" },
};

export default function AdminStudents() {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  // Debounce the search box so every keystroke doesn't hit the API.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const { data: studentPage, isLoading, error } = useQuery({
    queryKey: ["admin", "students", q, page],
    queryFn: () => adminApi.students({ q: q || undefined, page }),
  });
  const { data: statsData } = useQuery({
    queryKey: ["admin", "students", "stats"],
    queryFn: adminApi.studentStats,
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => adminApi.updateUserStatus(id, "AT_RISK"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
      toast.success("Student status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  const list = studentPage?.items ?? [];

  const stats = statsData
    ? [
        { icon: Users, label: "Total students", value: statsData.total },
        { icon: UserCheck, label: "Active", value: statsData.active },
        { icon: AlertTriangle, label: "At risk / idle", value: statsData.atRisk },
      ]
    : [];

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Students</h1>
        <p className="text-muted-foreground">Monitor engagement and re-activate at-risk learners.</p>
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
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
        <div className="grid grid-cols-3 gap-4">
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

      {/* Search */}
      <div className="relative sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Search students…"
          className="pl-9"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">Failed to load students.</p>
      )}

      <Card className="p-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Student</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Courses</TableHead>
                <TableHead>Total spent</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6"></TableHead>
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
                      onSuspend={() => suspendMutation.mutate(s.id)}
                      suspending={suspendMutation.isPending && suspendMutation.variables === s.id}
                    />
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {studentPage && studentPage.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {studentPage.page} of {studentPage.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= studentPage.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function StudentRow({
  student,
  onSuspend,
  suspending,
}: {
  student: AdminStudentDto;
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
      <TableCell className="text-sm">{student.country ?? "—"}</TableCell>
      <TableCell>{student.enrollments}</TableCell>
      <TableCell className="text-sm">{formatUsd(student.totalSpentCents / 100).replace(".00", "")}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {new Date(student.joinedAt).toLocaleDateString()}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={badge.cls}>{badge.label}</Badge>
      </TableCell>
      <TableCell className="pr-6 text-right">
        {student.status !== "AT_RISK" && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSuspend}
            disabled={suspending}
          >
            Flag at risk
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
