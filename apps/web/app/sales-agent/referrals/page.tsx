"use client";

import { useState } from "react";
import { useMySalesAgent, useMyAgentReferrals } from "@/lib/api/agent-hooks";
import { formatUsd, relativeDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Link2, TrendingUp, CheckCircle2, Clock } from "lucide-react";

const statusBadge = {
  paid:      { label: "Paid",      cls: "text-success" },
  confirmed: { label: "Confirmed", cls: "text-primary" },
  pending:   { label: "Pending",   cls: "text-warning" },
} as const;

export default function AgentReferrals() {
  const { data: agent } = useMySalesAgent();
  const { data: referrals } = useMyAgentReferrals();
  const [q, setQ] = useState("");

  if (!agent) return null;

  const all = referrals ?? [];
  const filtered = all.filter(
    (r) =>
      !q ||
      r.studentName.toLowerCase().includes(q.toLowerCase()) ||
      r.courseTitle.toLowerCase().includes(q.toLowerCase()),
  );

  const paid = all.filter((r) => r.status === "paid");
  const confirmed = all.filter((r) => r.status === "confirmed");
  const pending = all.filter((r) => r.status === "pending");

  const stats = [
    { icon: Link2, label: "Total referrals", value: all.length },
    { icon: CheckCircle2, label: "Paid", value: paid.length },
    { icon: TrendingUp, label: "Confirmed", value: confirmed.length },
    { icon: Clock, label: "Pending", value: pending.length },
  ];

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Referrals</h1>
        <p className="text-muted-foreground">All purchases attributed to your referral link or code.</p>
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

      <div className="relative sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student or course…" className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Order total</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    No referrals found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.studentName}</TableCell>
                    <TableCell className="text-muted-foreground">{r.courseTitle}</TableCell>
                    <TableCell>{formatUsd(r.orderTotalCents / 100)}</TableCell>
                    <TableCell className="font-mono font-medium text-success">
                      +{formatUsd(r.commissionCents / 100)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{relativeDate(r.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadge[r.status].cls}>
                        {statusBadge[r.status].label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
