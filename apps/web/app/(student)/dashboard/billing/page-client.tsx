"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMyOrders, useMyOrderStats } from "@/lib/api/hooks";
import { downloadFile } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/errors";
import { formatUsd } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Receipt,
  Search,
} from "lucide-react";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PAID:     { label: "Paid",     className: "text-success" },
  REFUNDED: { label: "Refunded", className: "text-destructive" },
  FAILED:   { label: "Failed",   className: "text-destructive" },
  PENDING:  { label: "Pending",  className: "text-muted-foreground" },
};

const GATEWAY_LABEL: Record<string, string> = {
  STRIPE:  "Stripe",
  PAYPAL:  "PayPal",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function BillingPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  // Debounce free-text search so keystrokes don't hit the API on every char.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const {
    data: orderPage,
    isLoading,
    isError,
  } = useMyOrders({ q: q || undefined, page, pageSize });
  const { data: stats } = useMyOrderStats();

  const rows = orderPage?.items ?? [];
  const totalPages = orderPage?.totalPages ?? 1;

  // If the current page falls off the end after a filter/pageSize change,
  // snap back to the last valid page.
  useEffect(() => {
    if (orderPage && page > orderPage.totalPages) setPage(orderPage.totalPages);
  }, [orderPage, page]);

  async function downloadReceipt(orderId: string) {
    setDownloading(orderId);
    try {
      await downloadFile(`/me/orders/${orderId}/receipt`, `receipt-${orderId}.pdf`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-6 p-4 md:space-y-8 md:p-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">Billing</h1>
        <p className="text-sm text-muted-foreground md:text-base">Your past purchases and receipts. Cards are handled by Stripe and PayPal at checkout — nothing is stored here.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Sidebar — total spent. On mobile it renders first (source order); on
         *  lg+ it snaps back to the right column via col-start-2. */}
        <div className="space-y-6 lg:col-start-2 lg:row-start-1">
          <Card>
            <CardHeader><CardTitle className="text-base">Total spent</CardTitle></CardHeader>
            <CardContent>
              {!stats ? (
                <Skeleton className="h-9 w-28" />
              ) : (
                <>
                  <div className="text-3xl font-bold">{formatUsd(stats.totalSpentCents / 100)}</div>
                  <p className="text-xs text-muted-foreground">
                    across {stats.paidCount} paid order{stats.paidCount !== 1 ? "s" : ""}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Purchase history */}
        <Card className="lg:col-start-1 lg:row-start-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-primary" /> Purchase history
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-0">
            <div className="flex flex-col gap-3 px-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative sm:max-w-xs sm:flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                  placeholder="Search by order id or course name…"
                  className="pl-9"
                  aria-label="Search orders"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows per page</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    setPageSize(Number(v));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3 px-6 py-2">
                {[1, 2, 3].map((n) => (
                  <Skeleton key={n} className="h-10 w-full rounded-md" />
                ))}
              </div>
            ) : isError ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">
                Could not load orders. Please try again later.
              </p>
            ) : rows.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                {q ? "No orders match your search." : "No purchases yet."}
              </p>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Gateway</TableHead>
                    <TableHead className="pr-6 text-right">Invoice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows?.map((o) => {
                    const badge = STATUS_BADGE[o.status] ?? STATUS_BADGE.PENDING;
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="pl-6 font-mono text-xs break-all">
                          {o.id}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(o.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {o.items[0]?.title ?? "—"}
                          {o.items.length > 1 && (
                            <span className="text-muted-foreground"> +{o.items.length - 1}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatUsd(o.totalCents / 100)}
                          <Badge variant="secondary" className={`ml-2 ${badge.className}`}>
                            {badge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {GATEWAY_LABEL[o.gateway] ?? o.gateway}
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Download receipt for order ${o.id}`}
                            // Only settled orders have a receipt — the API says the same.
                            disabled={
                              (o.status !== "PAID" && o.status !== "REFUNDED") ||
                              downloading === o.id
                            }
                            onClick={() => downloadReceipt(o.id)}
                          >
                            {downloading === o.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            )}

            {!isLoading && totalPages > 1 && (
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
