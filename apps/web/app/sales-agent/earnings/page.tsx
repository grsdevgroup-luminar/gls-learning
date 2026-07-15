"use client";

import { useMySalesAgent, useMyAgentReferrals } from "@/lib/api/agent-hooks";
import { formatUsd, relativeDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Wallet, Clock, CheckCircle2, DollarSign } from "lucide-react";

export default function AgentEarnings() {
  const { data: agent } = useMySalesAgent();
  const { data: referrals } = useMyAgentReferrals();

  if (!agent) return null;

  const all = referrals ?? [];
  const confirmed = all.filter((r) => r.status === "confirmed");
  const paid = all.filter((r) => r.status === "paid");
  const pending = all.filter((r) => r.status === "pending");

  const summary = [
    {
      icon: DollarSign,
      label: "Lifetime earned",
      value: formatUsd(agent.totalEarningsCents / 100),
      sub: "All confirmed + paid commissions",
      cls: "text-success",
    },
    {
      icon: Clock,
      label: "Pending",
      value: formatUsd(agent.pendingEarningsCents / 100),
      sub: "Awaiting order confirmation",
      cls: "text-warning",
    },
    {
      icon: CheckCircle2,
      label: "Confirmed",
      value: formatUsd(confirmed.reduce((s, r) => s + r.commissionCents, 0) / 100),
      sub: "Locked in, awaiting payout",
      cls: "text-primary",
    },
    {
      icon: Wallet,
      label: "Paid out",
      value: formatUsd(agent.paidEarningsCents / 100),
      sub: "Already transferred to you",
      cls: "text-muted-foreground",
    },
  ];

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Earnings</h1>
        <p className="text-muted-foreground">
          Commission ledger at {agent.commissionPercent}% per referred sale.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summary.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <s.icon className={`h-4 w-4 ${s.cls}`} /> {s.label}
              </div>
              <div className={`mt-1 text-2xl font-bold ${s.cls}`}>{s.value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{s.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paid commissions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paid.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    No paid commissions yet.
                  </TableCell>
                </TableRow>
              ) : (
                paid.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.studentName}</TableCell>
                    <TableCell className="text-muted-foreground">{r.courseTitle}</TableCell>
                    <TableCell>{formatUsd(r.orderTotalCents / 100)}</TableCell>
                    <TableCell className="font-mono font-medium text-success">+{formatUsd(r.commissionCents / 100)}</TableCell>
                    <TableCell className="text-muted-foreground">{relativeDate(r.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending commissions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.studentName}</TableCell>
                    <TableCell className="text-muted-foreground">{r.courseTitle}</TableCell>
                    <TableCell className="font-mono font-medium text-warning">+{formatUsd(r.commissionCents / 100)}</TableCell>
                    <TableCell className="text-muted-foreground">{relativeDate(r.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-warning">Pending</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
