"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { StatStrip, Stat } from "@/components/shared/stat-strip";
import { Stars } from "@/components/shared/stars";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { initials, compactNumber } from "@/lib/format";
import {
  Clock, Users, GraduationCap, CheckCircle2, Check, X, ExternalLink, Mail,
} from "lucide-react";
import { toast } from "sonner";

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AdminInstructors() {
  const qc = useQueryClient();
  const { data: applications = [] } = useQuery({
    queryKey: ["admin", "instructor-applications"],
    queryFn: () => api.adminInstructorApplications(),
  });
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin", "instructor-applications"] });
  const approveInstructor = useMutation({
    mutationFn: (id: string) => api.approveInstructorApplication(id),
    onSuccess: invalidate,
  });
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const rejectInstructor = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api.rejectInstructorApplication(id, note),
    onSuccess: (_, { id }) => {
      invalidate();
      const app = applications.find((a) => a.id === id);
      toast("Application rejected", { description: app?.name });
      setRejectingId(null);
      setRejectReason("");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const pending = applications?.filter((a) => a.status === "PENDING") ?? [];
  const decided = applications?.filter((a) => a.status !== "PENDING") ?? [];

  const { data: roster = [] } = useQuery({
    queryKey: ["admin", "instructors"],
    queryFn: () => api.instructors(),
  });

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Instructors</h1>
        <p className="text-muted-foreground">Review applications and manage your teaching roster.</p>
      </div>

      <StatStrip className="grid-cols-2 lg:grid-cols-3">
        <Stat icon={Clock} label="Pending applications" value={pending.length} tint="var(--tint-amber)" />
        <Stat icon={GraduationCap} label="Active instructors" value={roster.length} tint="var(--tint-indigo)" />
        <Stat icon={Users} label="Total students taught" value={compactNumber(roster?.reduce((s, i) => s + i.studentCount, 0) ?? 0)} tint="var(--tint-sky)" />
      </StatStrip>

      {/* Applications */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Applications</h2>
        {pending.length === 0 && decided.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No applications yet.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {pending?.map((a) => (
              <Card key={a.id} variant="elevated" className="gap-4 p-5">
                <CardContent className="flex flex-col gap-4 px-0 md:flex-row md:items-start md:justify-between">
                  <div className="flex gap-3">
                    <Avatar className="size-11 ring-1 ring-border">
                      <AvatarFallback className="brand-gradient text-sm text-white">{initials(a.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{a.name}</span>
                        <Badge variant="outline" className="gap-1 text-warning border-warning/30 bg-warning/10"><Clock className="size-3" /> Pending</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{a.headline} · {a.expertise}</p>
                      <p className="mt-2 max-w-xl text-sm leading-relaxed">{a.bio}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Mail className="size-3" /> {a.email}</span>
                        <span>Applied {shortDate(a.appliedAt)}</span>
                        {a.sampleUrl && (
                          <a href={a.sampleUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            <ExternalLink className="size-3" /> Sample
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Dialog
                      open={rejectingId === a.id}
                      onOpenChange={(o) => {
                        setRejectingId(o ? a.id : null);
                        if (!o) setRejectReason("");
                      }}
                    >
                      <DialogTrigger render={<Button variant="outline" size="sm" />}>
                        <X /> Reject
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader>
                          <DialogTitle>Reject application — {a.name}</DialogTitle>
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
                              onClick={() => rejectInstructor.mutate({ id: a.id, note: rejectReason.trim() })}
                            >
                              <X /> Reject
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button
                      size="sm"
                      onClick={() => { approveInstructor.mutate(a.id); toast.success("Instructor approved 🎉", { description: a.name }); }}
                    >
                      <Check /> Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {decided.map((a) => (
              <Card key={a.id} className="flex-row items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="size-9 ring-1 ring-border">
                    <AvatarFallback className="brand-gradient text-xs text-white">{initials(a.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.headline}</div>
                  </div>
                </div>
                {a.status === "APPROVED" ? (
                  <Badge variant="outline" className="gap-1 text-success border-success/30 bg-success/10"><CheckCircle2 className="size-3" /> Approved</Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-destructive border-destructive/30 bg-destructive/10"><X className="size-3" /> Rejected</Badge>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Roster */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Active instructors</h2>
        <Card className="p-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Instructor</TableHead>
                  <TableHead>Courses</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead className="pr-6">Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster?.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8 ring-1 ring-border">
                          <AvatarFallback className="brand-gradient text-xs text-white">{initials(i.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{i.name}</div>
                          <div className="text-xs text-muted-foreground">{i.title}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{i.courseCount}</TableCell>
                    <TableCell>{compactNumber(i.studentCount)}</TableCell>
                    <TableCell className="pr-6">{i.ratingAvg > 0 ? <Stars rating={i.ratingAvg} size={12} showValue /> : <span className="text-muted-foreground">—</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
