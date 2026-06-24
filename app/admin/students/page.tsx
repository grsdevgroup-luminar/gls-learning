"use client";

import { useState } from "react";
import { students, progressPct } from "@/lib/mock/students";
import { getCourseById } from "@/lib/mock/courses";
import { initials, formatUsd, relativeDate } from "@/lib/format";
import { Meter } from "@/components/shared/meter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Search, Users, UserCheck, AlertTriangle, Send, Mail, MessageSquare } from "lucide-react";
import type { Student } from "@/types";
import { toast } from "sonner";

const statusBadge: Record<Student["status"], { label: string; cls: string }> = {
  active: { label: "Active", cls: "text-success" },
  idle: { label: "Idle", cls: "text-warning" },
  at_risk: { label: "At risk", cls: "text-destructive" },
};

export default function AdminStudents() {
  const [q, setQ] = useState("");
  const list = students.filter((s) => !q || `${s.name} ${s.email}`.toLowerCase().includes(q.toLowerCase()));

  const stats = [
    { icon: Users, label: "Total students", value: students.length },
    { icon: UserCheck, label: "Active", value: students.filter((s) => s.status === "active").length },
    { icon: AlertTriangle, label: "At risk / idle", value: students.filter((s) => s.status !== "active").length },
  ];

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Students</h1>
        <p className="text-muted-foreground">Monitor engagement and re-activate at-risk learners.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><s.icon className="h-5 w-5" /></div>
              <div><div className="text-2xl font-bold leading-none">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students…" className="pl-9" />
      </div>

      <Card className="p-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Student</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Courses</TableHead>
                <TableHead>Avg. progress</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((s) => {
                const avg = s.enrollments.length ? Math.round(s.enrollments.reduce((a, e) => a + progressPct(e), 0) / s.enrollments.length) : 0;
                const last = s.enrollments.map((e) => e.lastActivity).sort().at(-1) ?? s.joinedAt;
                return (
                  <TableRow key={s.id} className={s.status === "at_risk" ? "bg-destructive/5" : ""}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9"><AvatarFallback className="text-xs">{initials(s.name)}</AvatarFallback></Avatar>
                        <div><div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.email}</div></div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{s.country}</TableCell>
                    <TableCell>{s.enrollments.length}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2"><Meter value={avg} height={6} className="w-20" /><span className="text-xs tabular-nums text-muted-foreground">{avg}%</span></div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{relativeDate(last)}</TableCell>
                    <TableCell><Badge variant="outline" className={statusBadge[s.status].cls}>{statusBadge[s.status].label}</Badge></TableCell>
                    <TableCell className="pr-6 text-right">
                      <StudentDetail student={s} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StudentDetail({ student }: { student: Student }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>View</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10"><AvatarFallback className="brand-gradient text-white">{initials(student.name)}</AvatarFallback></Avatar>
            <div>
              <div>{student.name}</div>
              <div className="text-xs font-normal text-muted-foreground">{student.email} · {student.country}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Spent" value={formatUsd(student.totalSpent).replace(".00", "")} />
          <Stat label="Streak" value={`${student.streakDays}d`} />
          <Stat label="Status" value={statusBadge[student.status].label} />
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Enrolled courses</h4>
          {student.enrollments.map((e) => {
            const c = getCourseById(e.courseId);
            const pct = progressPct(e);
            return (
              <div key={e.courseId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{c?.title}</span><span className="text-muted-foreground">{pct}%</span>
                </div>
                <Meter value={pct} height={6} />
                <div className="text-xs text-muted-foreground">Last active {relativeDate(e.lastActivity)}</div>
              </div>
            );
          })}
        </div>

        {student.status !== "active" && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-warning"><AlertTriangle className="h-4 w-4" /> This student is {statusBadge[student.status].label.toLowerCase()}</p>
            <p className="mt-1 text-xs text-muted-foreground">Send a re-engagement reminder to bring them back.</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => toast.success("Email reminder queued", { description: student.email })}><Mail /> Email reminder</Button>
              <Button size="sm" variant="outline" onClick={() => toast.success("SMS reminder queued")}><MessageSquare /> SMS</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
