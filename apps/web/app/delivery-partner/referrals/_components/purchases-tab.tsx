"use client";

import { useEffect, useState } from "react";
import { useMyPartnerReferrals } from "@/lib/api/delivery-partner-hooks";
import { formatUsd, relativeDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { StatStrip, Stat } from "@/components/shared/stat-strip";
import { CollapsibleStats } from "@/components/shared/collapsible-stats";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, ShoppingCart, TrendingUp, CheckCircle2, Clock } from "lucide-react";
import { useDebouncedSearch } from "@/lib/use-debounced-value";
import {
  AdminPagination, AdminRowsPerPage, ADMIN_PAGE_SIZE_OPTIONS,
} from "@/app/admin/_components/admin-pagination";
import {
  AdminTableCard, stickyHeaderCellClass, stickyHeaderRowClass,
} from "@/app/admin/_components/admin-table";

const statusBadge = {
  PAID:      { label: "Paid",      cls: "text-success" },
  CONFIRMED: { label: "Confirmed", cls: "text-primary" },
  PENDING:   { label: "Pending",   cls: "text-warning" },
  REVERSED:  { label: "Reversed",  cls: "text-destructive" },
} as const;

/** Members who joined by buying via one of the partner's campaign codes —
 *  formerly the whole "Referrals" page, now one of the two enrollment
 *  channels shown on the Members hub (the other is DirectInvitesTab). */
export function PurchasesTab() {
  const { data: referrals } = useMyPartnerReferrals();
  const [qInput, setQInput] = useState("");
  const q = useDebouncedSearch(qInput);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(ADMIN_PAGE_SIZE_OPTIONS[0]);

  const all = referrals ?? [];
  const filtered = all.filter((r) => {
    if (!q) return true;
    const query = q.toLowerCase();
    return (
      r.studentName.toLowerCase().includes(query) ||
      r.courseTitle.toLowerCase().includes(query) ||
      (r.campaignCode?.toLowerCase().includes(query) ?? false)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [q, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paid = all.filter((r) => r.status === "PAID");
  const confirmed = all.filter((r) => r.status === "CONFIRMED");
  const pending = all.filter((r) => r.status === "PENDING");

  return (
    <div className="space-y-4">
      <CollapsibleStats
        summary={`${all.length} purchases · ${paid.length} paid · ${confirmed.length} confirmed · ${pending.length} pending`}
      >
        <StatStrip className="grid-cols-2 lg:grid-cols-4">
          <Stat icon={ShoppingCart} label="Total purchases" value={all.length} tint="var(--tint-indigo)" />
          <Stat icon={CheckCircle2} label="Paid" value={paid.length} tint="var(--tint-emerald)" />
          <Stat icon={TrendingUp} label="Confirmed" value={confirmed.length} tint="var(--tint-sky)" />
          <Stat icon={Clock} label="Pending" value={pending.length} tint="var(--tint-amber)" />
        </StatStrip>
      </CollapsibleStats>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:max-w-sm sm:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search student, course, or campaign code…"
            className="search-input border-input bg-background pl-9 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:bg-input/30"
          />
        </div>
        <AdminRowsPerPage value={pageSize} onChange={setPageSize} />
      </div>

      {all.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No purchases yet — share a campaign code to get started.
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No purchases match this search.
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
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{r.studentName}</div>
                      <div className="truncate text-xs text-muted-foreground">{r.courseTitle}</div>
                    </div>
                    <Badge variant="outline" className={`shrink-0 ${statusBadge[r.status].cls}`}>
                      {statusBadge[r.status].label}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Campaign</span>
                    <span className="font-mono text-xs">{r.campaignCode ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Order total</span>
                    <span>{formatUsd(r.orderTotalCents / 100)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Commission</span>
                    <span className={`font-mono font-medium ${r.reversedCents > 0 ? "text-destructive" : "text-success"}`}>
                      {r.reversedCents > 0 ? "−" : "+"}
                      {formatUsd((r.reversedCents > 0 ? r.reversedCents : r.commissionCents) / 100)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Date</span>
                    <span className="text-xs text-muted-foreground">{relativeDate(r.createdAt)}</span>
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
                    <TableHead className={stickyHeaderCellClass}>Student</TableHead>
                    <TableHead className={stickyHeaderCellClass}>Course</TableHead>
                    <TableHead className={stickyHeaderCellClass}>Campaign</TableHead>
                    <TableHead className={stickyHeaderCellClass}>Order total</TableHead>
                    <TableHead className={stickyHeaderCellClass}>Commission</TableHead>
                    <TableHead className={stickyHeaderCellClass}>Date</TableHead>
                    <TableHead className={stickyHeaderCellClass}>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.studentName}</TableCell>
                      <TableCell className="text-muted-foreground">{r.courseTitle}</TableCell>
                      <TableCell className="font-mono text-xs">{r.campaignCode ?? "—"}</TableCell>
                      <TableCell>{formatUsd(r.orderTotalCents / 100)}</TableCell>
                      <TableCell className={`font-mono font-medium ${r.reversedCents > 0 ? "text-destructive" : "text-success"}`}>
                        {r.reversedCents > 0 ? "−" : "+"}
                        {formatUsd((r.reversedCents > 0 ? r.reversedCents : r.commissionCents) / 100)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{relativeDate(r.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadge[r.status].cls}>
                          {statusBadge[r.status].label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminTableCard>
          </div>
        </>
      )}

      <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} total={filtered.length} itemLabel="purchase" />
    </div>
  );
}
