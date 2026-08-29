"use client";

import { useState } from "react";
import { CreditLedgerReason } from "@skillstream/shared";
import { useMyCreditBalances, useMyCreditHistory } from "@/lib/api/hooks";
import { formatUsd } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  Wallet,
} from "lucide-react";

const PAGE_SIZE = 20;

const REASON_LABEL: Record<CreditLedgerReason, string> = {
  GRANT_REFUND: "Refund credit",
  SPEND_CHECKOUT: "Applied at checkout",
  ADJUST_MANUAL: "Manual adjustment",
};

export default function CreditsPage() {
  const [page, setPage] = useState(1);
  const { data: balances, isLoading: balancesLoading } = useMyCreditBalances();
  const {
    data: historyPage,
    isLoading: historyLoading,
    isError,
  } = useMyCreditHistory({ page, pageSize: PAGE_SIZE });

  const rows = historyPage?.items ?? [];
  const totalPages = historyPage?.totalPages ?? 1;

  return (
    <div className="space-y-6 p-4 md:space-y-8 md:p-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">Store credit</h1>
        <p className="text-sm text-muted-foreground md:text-base">
          Credit from refunded orders. Apply it at checkout on your next purchase.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6 lg:col-start-2 lg:row-start-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4 text-primary" /> Balance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {balancesLoading ? (
                <Skeleton className="h-9 w-28" />
              ) : !balances || balances.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No credit yet.
                </p>
              ) : (
                balances.map((b) => (
                  <div key={b.currency}>
                    <div className="text-3xl font-bold">
                      {formatUsd(b.amountCents / 100)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {b.currency}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-start-1 lg:row-start-1">
          <CardHeader>
            <CardTitle className="text-base">Credit history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-0">
            {historyLoading ? (
              <div className="space-y-3 px-6 py-2">
                {[1, 2, 3].map((n) => (
                  <Skeleton key={n} className="h-10 w-full rounded-md" />
                ))}
              </div>
            ) : isError ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">
                Could not load credit history.
              </p>
            ) : rows.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                No credit activity yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Date</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead className="pr-6 text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((e) => {
                      const positive = e.amountCents >= 0;
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="pl-6 text-sm text-muted-foreground">
                            {new Date(e.createdAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="text-sm">
                            <Badge variant="secondary">
                              {REASON_LABEL[e.reason] ?? e.reason}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-72 truncate text-sm text-muted-foreground">
                            {e.comment ?? (e.orderId ? `Order ${e.orderId.slice(0, 8)}…` : "—")}
                          </TableCell>
                          <TableCell
                            className={`pr-6 text-right font-medium ${
                              positive ? "text-success" : "text-destructive"
                            }`}
                          >
                            {positive ? "+" : "−"}
                            {formatUsd(Math.abs(e.amountCents) / 100)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {!historyLoading && totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
