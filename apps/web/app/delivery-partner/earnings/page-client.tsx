"use client";

import { useEffect, useState } from "react";
import { useMyDeliveryPartner, useMyPartnerReferrals } from "@/lib/api/delivery-partner-hooks";
import { PartnerMissingState, PartnerPageLoading, PartnerStatusState } from "../_components/partner-page-state";
import { PayoutPanel } from "@/components/shared/payout-panel";
import { formatUsd, relativeDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Wallet, Clock, CheckCircle2, DollarSign } from "lucide-react";
import {
  AdminPagination,
  AdminRowsPerPage,
  ADMIN_PAGE_SIZE_OPTIONS,
} from "@/app/admin/_components/admin-pagination";
import {
  stickyHeaderCellClass,
  stickyHeaderRowClass,
} from "@/app/admin/_components/admin-table";

export default function PartnerEarnings() {
  const { data: partner, isLoading } = useMyDeliveryPartner();
  const { data: referrals } = useMyPartnerReferrals();
  const [paidPage, setPaidPage] = useState(1);
  const [paidPageSize, setPaidPageSize] = useState<number>(ADMIN_PAGE_SIZE_OPTIONS[0]);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState<number>(ADMIN_PAGE_SIZE_OPTIONS[0]);

  const all = referrals ?? [];
  const confirmed = all?.filter((r) => r.status === "confirmed") ?? [];
  const paid = all?.filter((r) => r.status === "paid") ?? [];
  const pending = all?.filter((r) => r.status === "pending") ?? [];
  const paidTotalPages = Math.max(1, Math.ceil(paid.length / paidPageSize));
  const pendingTotalPages = Math.max(1, Math.ceil(pending.length / pendingPageSize));
  const pagedPaid = paid.slice((paidPage - 1) * paidPageSize, paidPage * paidPageSize);
  const pagedPending = pending.slice(
    (pendingPage - 1) * pendingPageSize,
    pendingPage * pendingPageSize,
  );

  useEffect(() => {
    setPaidPage(1);
  }, [paidPageSize]);

  useEffect(() => {
    setPendingPage(1);
  }, [pendingPageSize]);

  useEffect(() => {
    if (paidPage > paidTotalPages) setPaidPage(paidTotalPages);
  }, [paidPage, paidTotalPages]);

  useEffect(() => {
    if (pendingPage > pendingTotalPages) setPendingPage(pendingTotalPages);
  }, [pendingPage, pendingTotalPages]);

  if (isLoading) return <PartnerPageLoading />;
  if (!partner) return <PartnerMissingState />;
  if (partner.status !== "APPROVED") return <PartnerStatusState status={partner.status} />;

  const summary = [
    {
      icon: DollarSign,
      label: "Lifetime earned",
      value: formatUsd(partner.totalEarningsCents / 100),
      sub: "All confirmed + paid commissions",
      cls: "text-success",
    },
    {
      icon: Clock,
      label: "Pending",
      value: formatUsd(partner.pendingEarningsCents / 100),
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
      value: formatUsd(partner.paidEarningsCents / 100),
      sub: "Already transferred to you",
      cls: "text-muted-foreground",
    },
  ];

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Earnings</h1>
        <p className="text-muted-foreground">
          Commission ledger at {partner.commissionPercent}% per referred sale.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summary?.map((s) => (
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

      <PayoutPanel />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paid commissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-0">
          <div className="px-6 pt-4">
            <AdminRowsPerPage
              value={paidPageSize}
              onChange={(value) => {
                setPaidPageSize(value);
                setPaidPage(1);
              }}
            />
          </div>
          <div className="max-h-[560px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className={stickyHeaderRowClass}>
                <TableHead className={stickyHeaderCellClass}>Student</TableHead>
                <TableHead className={stickyHeaderCellClass}>Course</TableHead>
                <TableHead className={stickyHeaderCellClass}>Order</TableHead>
                <TableHead className={stickyHeaderCellClass}>Commission</TableHead>
                <TableHead className={stickyHeaderCellClass}>Date</TableHead>
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
                pagedPaid.map((r) => (
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
          </div>
          <div className="px-6 pb-4">
            <AdminPagination page={paidPage} totalPages={paidTotalPages} onPageChange={setPaidPage} />
          </div>
        </CardContent>
      </Card>

      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending commissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-0">
            <div className="px-6 pt-4">
              <AdminRowsPerPage
                value={pendingPageSize}
                onChange={(value) => {
                  setPendingPageSize(value);
                  setPendingPage(1);
                }}
              />
            </div>
            <div className="max-h-[560px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className={stickyHeaderRowClass}>
                  <TableHead className={stickyHeaderCellClass}>Student</TableHead>
                  <TableHead className={stickyHeaderCellClass}>Course</TableHead>
                  <TableHead className={stickyHeaderCellClass}>Commission</TableHead>
                  <TableHead className={stickyHeaderCellClass}>Date</TableHead>
                  <TableHead className={stickyHeaderCellClass}>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedPending.map((r) => (
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
            </div>
            <div className="px-6 pb-4">
              <AdminPagination page={pendingPage} totalPages={pendingTotalPages} onPageChange={setPendingPage} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
