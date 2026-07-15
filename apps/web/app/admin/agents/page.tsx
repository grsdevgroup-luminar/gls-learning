"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import type { SalesAgentDto } from "@skillstream/shared";
import { initials, formatUsd } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Link2, DollarSign, Users, Search, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

type AgentApplication = {
  id: string;
  name: string;
  email: string;
  region: string;
  bio: string;
  status: string;
  appliedAt: string;
};

const statusCls: Record<string, string> = {
  APPROVED: "text-success",
  PENDING: "text-warning",
  REJECTED: "text-destructive",
  SUSPENDED: "text-muted-foreground",
};

export default function AdminAgents() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [commissionInputs, setCommissionInputs] = useState<Record<string, string>>({});
  const [reviewingApp, setReviewingApp] = useState<string | null>(null);
  const [appCommission, setAppCommission] = useState("10");
  const [appNote, setAppNote] = useState("");

  const { data: agents = [], isLoading } = useQuery<SalesAgentDto[]>({
    queryKey: ["admin-sales-agents"],
    queryFn: () => apiFetch("/admin/sales-agents"),
  });

  const { data: applications = [] } = useQuery<AgentApplication[]>({
    queryKey: ["admin-agent-applications"],
    queryFn: () => apiFetch("/admin/sales-agent-applications"),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, commissionPercent, note }: { id: string; status: string; commissionPercent?: number; note?: string }) =>
      apiFetch(`/admin/sales-agent-applications/${id}/review`, {
        method: "POST",
        body: { status, commissionPercent, note },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-agent-applications"] });
      qc.invalidateQueries({ queryKey: ["admin-sales-agents"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { commissionPercent?: number } }) =>
      apiFetch(`/admin/sales-agents/${id}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-sales-agents"] }),
  });

  const payoutMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/sales-agents/${id}/payout`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-sales-agents"] }),
  });

  const filtered = agents.filter(
    (a) => !q || `${a.name} ${a.email} ${a.referralCode}`.toLowerCase().includes(q.toLowerCase()),
  );
  const pending = applications.filter((a) => a.status === "PENDING");

  const stats = [
    { icon: Users, label: "Total agents", value: agents.filter((a) => a.status === "APPROVED").length },
    { icon: Link2, label: "Total referrals", value: agents.reduce((s, a) => s + a.referralCount, 0) },
    { icon: DollarSign, label: "Commissions paid", value: formatUsd(agents.reduce((s, a) => s + a.paidEarningsCents, 0) / 100) },
    { icon: DollarSign, label: "Pending", value: formatUsd(agents.reduce((s, a) => s + a.pendingEarningsCents, 0) / 100) },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 p-6 md:p-8">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sales Agents</h1>
        <p className="text-muted-foreground">Manage your worldwide sales agent network and commission rates.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      {pending.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">
            Applications{" "}
            <Badge variant="outline" className="ml-1 text-warning">{pending.length} pending</Badge>
          </h2>
          <div className="space-y-3">
            {pending.map((app) => (
              <Card key={app.id}>
                <CardContent className="flex flex-wrap items-start gap-4 pt-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{app.name}</div>
                    <div className="text-sm text-muted-foreground">{app.email}</div>
                    <div className="mt-1 text-sm">Region: {app.region}</div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{app.bio}</p>
                  </div>
                  <Dialog
                    open={reviewingApp === app.id}
                    onOpenChange={(o) => {
                      setReviewingApp(o ? app.id : null);
                      if (!o) { setAppNote(""); setAppCommission("10"); }
                    }}
                  >
                    <DialogTrigger render={<Button size="sm" />}>
                      <CheckCircle2 className="h-4 w-4" /> Review
                    </DialogTrigger>
                    <DialogContent className="max-w-sm">
                      <DialogHeader>
                        <DialogTitle>Review — {app.name}</DialogTitle>
                      </DialogHeader>
                      <div className="mt-2 space-y-4">
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Commission %</label>
                          <Input type="number" min={1} max={50} value={appCommission} onChange={(e) => setAppCommission(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Note (optional)</label>
                          <Input value={appNote} onChange={(e) => setAppNote(e.target.value)} placeholder="Internal note…" />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            className="text-destructive"
                            disabled={reviewMutation.isPending}
                            onClick={() => {
                              reviewMutation.mutate({ id: app.id, status: "REJECTED", note: appNote || undefined });
                              toast.success("Application rejected");
                              setReviewingApp(null);
                            }}
                          >
                            <XCircle className="h-4 w-4" /> Reject
                          </Button>
                          <Button
                            disabled={reviewMutation.isPending}
                            onClick={() => {
                              reviewMutation.mutate({
                                id: app.id,
                                status: "APPROVED",
                                commissionPercent: parseFloat(appCommission) || 10,
                                note: appNote || undefined,
                              });
                              toast.success("Agent approved");
                              setReviewingApp(null);
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4" /> Approve
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">All agents</h2>
          <div className="relative sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search agents…" className="pl-9" />
          </div>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Referrals</TableHead>
                  <TableHead>Earnings</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No agents found.</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs">{initials(a.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-sm font-medium">{a.name}</div>
                            <div className="text-xs text-muted-foreground">{a.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{a.region}</TableCell>
                      <TableCell className="font-mono text-xs">{a.referralCode}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={1}
                            max={50}
                            className="h-7 w-16 text-sm"
                            value={commissionInputs[a.id] ?? a.commissionPercent}
                            onChange={(e) => setCommissionInputs((p) => ({ ...p, [a.id]: e.target.value }))}
                          />
                          <span className="text-sm">%</span>
                          {commissionInputs[a.id] !== undefined && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              disabled={updateMutation.isPending}
                              onClick={() => {
                                updateMutation.mutate({
                                  id: a.id,
                                  body: { commissionPercent: parseFloat(commissionInputs[a.id]) || a.commissionPercent },
                                });
                                setCommissionInputs((p) => { const n = { ...p }; delete n[a.id]; return n; });
                                toast.success("Commission updated");
                              }}
                            >
                              Save
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{a.referralCount}</TableCell>
                      <TableCell className="text-sm">{formatUsd(a.totalEarningsCents / 100)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusCls[a.status] ?? ""}>
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {a.pendingEarningsCents > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={payoutMutation.isPending}
                            onClick={() => {
                              payoutMutation.mutate(a.id);
                              toast.success(`Payout processed for ${a.name}`);
                            }}
                          >
                            Pay out
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
