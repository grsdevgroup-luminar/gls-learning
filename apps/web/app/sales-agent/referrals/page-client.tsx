"use client";

import { useEffect, useState } from "react";
import { useMySalesAgent, useMyAgentReferrals } from "@/lib/api/agent-hooks";
import { formatUsd, relativeDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Link2, TrendingUp, CheckCircle2, Clock } from "lucide-react";
import { useDebouncedSearch } from "@/lib/use-debounced-value";
import {
  AdminPagination,
  AdminRowsPerPage,
  ADMIN_PAGE_SIZE_OPTIONS,
} from "@/app/admin/_components/admin-pagination";
import {
  AdminTableCard,
  stickyHeaderCellClass,
  stickyHeaderRowClass,
} from "@/app/admin/_components/admin-table";

const statusBadge = {
  paid:      { label: "Paid",      cls: "text-success" },
  confirmed: { label: "Confirmed", cls: "text-primary" },
  pending:   { label: "Pending",   cls: "text-warning" },
} as const;

export default function AgentReferrals() {
  const { data: agent } = useMySalesAgent();
  const { data: referrals } = useMyAgentReferrals();
  const [qInput, setQInput] = useState("");
  const q = useDebouncedSearch(qInput);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(ADMIN_PAGE_SIZE_OPTIONS[0]);

  const all = referrals ?? [];
  const filtered = all?.filter(
    (r) =>
      !q ||
      r.studentName.toLowerCase().includes(q.toLowerCase()) ||
      r.courseTitle.toLowerCase().includes(q.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [q, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (!agent) return null;

  const paid = all?.filter((r) => r.status === "paid") ?? [];
  const confirmed = all?.filter((r) => r.status === "confirmed") ?? [];
  const pending = all?.filter((r) => r.status === "pending") ?? [];

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
        <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search student or course…" className="pl-9" />
      </div>

      <AdminRowsPerPage
        value={pageSize}
        onChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
      />

      <AdminTableCard>
          <Table>
            <TableHeader>
              <TableRow className={stickyHeaderRowClass}>
                <TableHead className={stickyHeaderCellClass}>Student</TableHead>
                <TableHead className={stickyHeaderCellClass}>Course</TableHead>
                <TableHead className={stickyHeaderCellClass}>Order total</TableHead>
                <TableHead className={stickyHeaderCellClass}>Commission</TableHead>
                <TableHead className={stickyHeaderCellClass}>Date</TableHead>
                <TableHead className={stickyHeaderCellClass}>Status</TableHead>
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
                paged.map((r) => (
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
      </AdminTableCard>

      <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
