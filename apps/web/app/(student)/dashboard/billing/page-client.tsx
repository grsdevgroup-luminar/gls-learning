"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { OrderDto } from "@skillstream/shared";
import { useMyOrders, useMyOrderStats } from "@/lib/api/hooks";
import { downloadFile, fetchFile } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/errors";
import { formatUsd } from "@/lib/format";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
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
  Eye,
  Loader2,
  Receipt,
  Search,
} from "lucide-react";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PAID:               { label: "Paid",               className: "text-success" },
  PARTIALLY_REFUNDED: { label: "Partially refunded", className: "text-warning" },
  REFUNDED:           { label: "Refunded",           className: "text-destructive" },
  FAILED:             { label: "Failed",             className: "text-destructive" },
  PENDING:            { label: "Pending",            className: "text-muted-foreground" },
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
  const [viewing, setViewing] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);

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

  async function viewReceipt(orderId: string) {
    const preview = window.open("about:blank", "_blank");
    if (!preview) {
      toast.error("Please allow pop-ups to view the receipt.");
      return;
    }
    setViewing(orderId);
    preview.document.title = "Loading receipt...";
    try {
      const url = URL.createObjectURL(await fetchFile(`/me/orders/${orderId}/receipt`));
      preview.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      preview.close();
      toast.error(getApiErrorMessage(err));
    } finally {
      setViewing(null);
    }
  }

  return (
    <div className="space-y-6 p-4 md:space-y-8 md:p-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">Billing</h1>
        <p className="text-sm text-muted-foreground md:text-base">Your past purchases and receipts. Cards are handled by Stripe and PayPal at checkout — nothing is stored here.</p>
      </div>

      <Card className="flex h-[calc(100vh-12rem)] min-h-[420px] flex-col overflow-hidden">
        <div className="sticky top-0 z-20 border-b border-border bg-card px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total spent</p>
              {!stats ? (
                <Skeleton className="mt-2 h-9 w-28" />
              ) : (
                <>
                  <div className="mt-1 text-3xl font-bold">{formatUsd(stats.totalSpentCents / 100)}</div>
                  <p className="text-xs text-muted-foreground">
                    across {stats.paidCount} paid order{stats.paidCount !== 1 ? "s" : ""}
                  </p>
                </>
              )}
            </div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-primary" /> Purchase history
            </CardTitle>
          </div>
        </div>

        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 px-0">
          <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-border bg-card px-6 pb-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative sm:max-w-xs sm:flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                  placeholder="Search by order id or course name…"
                  className="search-input border-input bg-background pl-9 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:bg-input/30"
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

          <div className="min-h-0 flex-1 overflow-auto">
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
              <div className="min-w-[980px]">
              <Table>
                <TableHeader className="sticky top-0 z-[2] bg-card">
                  <TableRow>
                    <TableHead className="pl-6">Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Gateway</TableHead>
                    <TableHead className="sticky right-0 z-[1] bg-card pr-6 text-right">Invoice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows?.map((o) => {
                    const badge = STATUS_BADGE[o.status] ?? STATUS_BADGE.PENDING;
                    return (
                      <TableRow
                        key={o.id}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer"
                        aria-label={`View purchase details for order ${o.id}`}
                        onClick={() => setSelectedOrder(o)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedOrder(o);
                          }
                        }}
                      >
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
                          {o.refundedCents > 0 && (
                            <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                              <div>
                                Credited back {formatUsd(o.refundedCents / 100)}
                              </div>
                              {/* Per-course refund breakdown so student sees
                                  exactly which item got credited and how much. */}
                              {o.items
                                .filter((i) => i.refundedCents > 0)
                                .map((i) => {
                                  const fully = i.refundedCents >= i.priceCents;
                                  return (
                                    <div key={i.id}>
                                      {fully ? "Refunded" : "Partial refund"}:{" "}
                                      <span className="text-foreground">
                                        {i.title}
                                      </span>{" "}
                                      ({formatUsd(i.refundedCents / 100)})
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {GATEWAY_LABEL[o.gateway] ?? o.gateway}
                        </TableCell>
                        <TableCell
                          className="sticky right-0 z-[1] bg-card pr-6 text-right"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`View receipt for order ${o.id}`}
                            title="View receipt"
                            disabled={
                              (o.status !== "PAID" &&
                                o.status !== "REFUNDED" &&
                                o.status !== "PARTIALLY_REFUNDED") ||
                              viewing === o.id ||
                              downloading === o.id
                            }
                            onClick={() => viewReceipt(o.id)}
                          >
                            {viewing === o.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Download receipt for order ${o.id}`}
                            disabled={
                              (o.status !== "PAID" &&
                                o.status !== "REFUNDED" &&
                                o.status !== "PARTIALLY_REFUNDED") ||
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
          </div>

          {!isLoading && rows.length > 0 && (
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

      <Dialog
        open={selectedOrder !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedOrder(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Purchase details</DialogTitle>
            <DialogDescription>
              Order {selectedOrder?.id}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Purchase date</p>
                  <p className="font-medium">
                    {new Date(selectedOrder.createdAt).toLocaleDateString("en-US", {
                      year: "numeric", month: "long", day: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment status</p>
                  <Badge
                    variant="secondary"
                    className={STATUS_BADGE[selectedOrder.status]?.className}
                  >
                    {STATUS_BADGE[selectedOrder.status]?.label ?? selectedOrder.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment method</p>
                  <p className="font-medium">
                    {GATEWAY_LABEL[selectedOrder.gateway] ?? selectedOrder.gateway}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-medium">
                    {formatUsd(selectedOrder.totalCents / 100)}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="mb-3 text-sm font-medium">Purchased courses</p>
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-4 text-sm">
                      <span>{item.title}</span>
                      <span className="shrink-0 font-medium">
                        {formatUsd(item.priceCents / 100)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {(selectedOrder.discountCents > 0 || selectedOrder.creditAppliedCents > 0) && (
                <div className="border-t pt-4 text-sm text-muted-foreground">
                  {selectedOrder.discountCents > 0 && (
                    <div className="flex justify-between">
                      <span>Coupon discount</span>
                      <span>-{formatUsd(selectedOrder.discountCents / 100)}</span>
                    </div>
                  )}
                  {selectedOrder.creditAppliedCents > 0 && (
                    <div className="flex justify-between">
                      <span>Store credit</span>
                      <span>-{formatUsd(selectedOrder.creditAppliedCents / 100)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
