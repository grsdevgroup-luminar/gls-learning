"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, type OrderDto } from "@/lib/api/endpoints";
import { formatUsd } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OrderStatus } from "@skillstream/shared";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Check,
  Copy,
  CreditCard,
  DollarSign,
  RotateCcw,
  Search,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdminPagination,
  AdminRowsPerPage,
  ADMIN_PAGE_SIZE_OPTIONS,
} from "../_components/admin-pagination";
import {
  AdminTableCard,
  stickyHeaderCellClass,
  stickyHeaderRowClass,
} from "../_components/admin-table";

const statusCls: Record<string, string> = {
  PAID: "text-success",
  PARTIALLY_REFUNDED: "text-warning",
  REFUNDED: "text-destructive",
  FAILED: "text-muted-foreground",
  PENDING: "text-warning",
};

const STATUS_LABELS: Record<string, string> = {
  PAID: "Paid",
  PARTIALLY_REFUNDED: "Partially refunded",
  REFUNDED: "Refunded",
  FAILED: "Failed",
  PENDING: "Pending",
};

const STATUS_FILTERS = ["all", ...Object.values(OrderStatus)] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

/** Cap the refundable pool at the money-paid portion. Credit-applied cents
 *  can't be handed back as new credit without compounding the ledger. */
function orderRefundablePool(order: OrderDto): number {
  return Math.max(0, order.totalCents - order.creditAppliedCents);
}

function orderRemainingRefundable(order: OrderDto): number {
  return Math.max(0, orderRefundablePool(order) - order.refundedCents);
}

function itemRemainingRefundable(item: OrderDto["items"][number]): number {
  return Math.max(0, item.priceCents - item.refundedCents);
}

// Per-item row state in the refund dialog. `amountText` is the raw input string
// (kept so the field stays freely editable — no snap-back to "0.00" mid-type),
// `amountCents` is its parsed, clamped cents value used for totals and payload.
interface RefundRow {
  selected: boolean;
  amountText: string;
  amountCents: number;
}

export default function AdminOrders() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(ADMIN_PAGE_SIZE_OPTIONS[0]);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [refundTarget, setRefundTarget] = useState<OrderDto | null>(null);

  // Debounce search box so every keystroke doesn't hit the API.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const { data: orderPage, isLoading, error } = useQuery({
    queryKey: ["admin", "orders", "list", { q, status, page, pageSize }],
    queryFn: () =>
      adminApi.orders({
        q: q || undefined,
        status: status === "all" ? undefined : status,
        page,
        pageSize,
      }),
    placeholderData: (prev) => prev,
  });

  const { data: orderStats } = useQuery({
    queryKey: ["admin", "orders", "stats"],
    queryFn: adminApi.orderStats,
  });

  const pagedOrders = orderPage?.items ?? [];
  const totalPages = orderPage?.totalPages ?? 1;
  const matchingTotal = orderPage?.total ?? 0;

  useEffect(() => {
    if (orderPage && page > orderPage.totalPages) setPage(orderPage.totalPages);
  }, [orderPage, page]);

  const refundMutation = useMutation({
    mutationFn: (input: {
      id: string;
      comment: string;
      items: { orderItemId: string; amountCents: number }[];
    }) => adminApi.refundOrder(input.id, { comment: input.comment, items: input.items }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      setRefundTarget(null);
      toast.success(
        vars.items.length === 1
          ? "Credit issued for 1 item"
          : `Credit issued for ${vars.items.length} items`,
      );
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error && err.message ? err.message : "Refund failed";
      toast.error(message);
    },
  });

  const stats = [
    {
      icon: DollarSign,
      label: "Gross revenue",
      value: orderStats
        ? formatUsd(orderStats.grossPaidCents / 100).replace(".00", "")
        : "—",
    },
    {
      icon: ShoppingBag,
      label: "Orders",
      value: orderStats?.total ?? "—",
    },
    {
      icon: RotateCcw,
      label: "Refunds",
      value: orderStats?.refundCount ?? "—",
    },
  ];

  const statsLoading = !orderStats;

  return (
    <div className="flex flex-col space-y-6 p-6 md:h-dvh md:overflow-hidden md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">Transactions across Stripe and PayPal.</p>
      </div>

      <div className="grid grid-cols-3 gap-4 shrink-0">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 pt-6">
              {statsLoading ? (
                <>
                  <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
                  <div className="space-y-1.5">
                    <div className="h-7 w-16 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold leading-none">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center shrink-0">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search by order id, coupon, user, item…"
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            if (!value) return;
            setStatus(value as StatusFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[11.5rem]" aria-label="Filter by status">
            <SelectValue>
              {status === "all" ? "All statuses" : STATUS_LABELS[status]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All statuses" : STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="sm:ml-auto">
          <AdminRowsPerPage
            value={pageSize}
            onChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive shrink-0">Failed to load orders.</p>
      )}

      <AdminTableCard className="min-h-0 flex-1" scrollClassName="max-h-none">
          <Table>
            <TableHeader>
              <TableRow className={stickyHeaderRowClass}>
                <TableHead className={`pl-6 ${stickyHeaderCellClass}`}>Order</TableHead>
                <TableHead className={stickyHeaderCellClass}>Items</TableHead>
                <TableHead className={stickyHeaderCellClass}>Coupon</TableHead>
                <TableHead className={stickyHeaderCellClass}>Gateway</TableHead>
                <TableHead className={stickyHeaderCellClass}>Total</TableHead>
                <TableHead className={stickyHeaderCellClass}>Status</TableHead>
                <TableHead className={`pr-6 ${stickyHeaderCellClass}`}></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? [...Array(10)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(7)].map((__, j) => (
                        <TableCell key={j} className={j === 0 ? "pl-6" : j === 6 ? "pr-6" : ""}>
                          <div className="h-4 w-full animate-pulse rounded bg-muted" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : pagedOrders.map((o) => (
                    <OrderRow
                      key={o.id}
                      order={o}
                      onRefund={() => setRefundTarget(o)}
                      refunding={
                        refundMutation.isPending &&
                        refundMutation.variables?.id === o.id
                      }
                    />
                  ))}
            </TableBody>
          </Table>
      </AdminTableCard>

      {!isLoading && (
        <div className="shrink-0">
          <AdminPagination
            page={page}
            totalPages={totalPages}
            total={matchingTotal}
            itemLabel="order"
            onPageChange={setPage}
          />
        </div>
      )}

      <RefundDialog
        order={refundTarget}
        onClose={() => {
          if (!refundMutation.isPending) setRefundTarget(null);
        }}
        submitting={refundMutation.isPending}
        onSubmit={(items, comment) =>
          refundTarget &&
          refundMutation.mutate({ id: refundTarget.id, items, comment })
        }
      />
    </div>
  );
}

function OrderRow({
  order,
  onRefund,
  refunding,
}: {
  order: OrderDto;
  onRefund: () => void;
  refunding: boolean;
}) {
  const remaining = orderRemainingRefundable(order);
  const canRefund =
    (order.status === "PAID" || order.status === "PARTIALLY_REFUNDED") &&
    remaining > 0;
  return (
    <TableRow>
      <TableCell className="pl-6">
        <div className="flex items-start gap-1.5">
          <span className="font-mono text-xs break-all">{order.id}</span>
          <CopyOrderId id={order.id} />
        </div>
        <div className="text-xs text-muted-foreground">
          {new Date(order.createdAt).toLocaleDateString()}
        </div>
      </TableCell>
      <TableCell className="max-w-48 truncate text-sm">
        {order.items.length} {order.items.length === 1 ? "item" : "items"}
      </TableCell>
      <TableCell>
        {order.couponCode ? (
          <Badge variant="secondary">{order.couponCode}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1 text-sm capitalize">
          <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
          {order.gateway.charAt(0) + order.gateway.slice(1).toLowerCase()}
        </span>
      </TableCell>
      <TableCell className="font-medium">
        {formatUsd(order.totalCents / 100)}
        {order.refundedCents > 0 && (
          <div className="text-xs text-muted-foreground">
            Refunded {formatUsd(order.refundedCents / 100)}
          </div>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={statusCls[order.status] ?? ""}
        >
          {STATUS_LABELS[order.status] ?? order.status}
        </Badge>
      </TableCell>
      <TableCell className="pr-6 text-right">
        {canRefund && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefund}
            disabled={refunding}
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Refund
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function RefundDialog({
  order,
  onClose,
  onSubmit,
  submitting,
}: {
  order: OrderDto | null;
  onClose: () => void;
  onSubmit: (
    items: { orderItemId: string; amountCents: number }[],
    comment: string,
  ) => void;
  submitting: boolean;
}) {
  const [rows, setRows] = useState<Record<string, RefundRow>>({});
  const [comment, setComment] = useState("");

  // Seed / reset the dialog whenever a fresh order lands. Items with any
  // remaining refundable amount default to selected + prefilled with the max —
  // matching the "refund what's left" mental model most of the time.
  useEffect(() => {
    if (!order) return;
    const next: Record<string, RefundRow> = {};
    for (const item of order.items) {
      const remaining = itemRemainingRefundable(item);
      next[item.id] = {
        selected: remaining > 0,
        amountText: (remaining / 100).toFixed(2),
        amountCents: remaining,
      };
    }
    setRows(next);
    setComment("");
  }, [order?.id]);

  const totalCents = useMemo(
    () =>
      order
        ? order.items.reduce(
            (sum, item) =>
              sum + (rows[item.id]?.selected ? rows[item.id].amountCents : 0),
            0,
          )
        : 0,
    [order, rows],
  );

  const orderPool = order ? orderRefundablePool(order) : 0;
  const orderRemaining = order ? orderRemainingRefundable(order) : 0;
  const canSubmit =
    !!order &&
    !submitting &&
    totalCents > 0 &&
    totalCents <= orderRemaining &&
    comment.trim().length >= 3;
  const isFullRemainder = !!order && totalCents === orderRemaining && totalCents > 0;

  const setAmount = (itemId: string, dollars: string, maxCents: number) => {
    // Preserve the raw text so the field stays freely editable while typing.
    // Cents get parsed + clamped for totals/payload; empty or partial input
    // (e.g. "" or ".") coerces to 0 cents but keeps the visible text.
    const value = Number.parseFloat(dollars);
    const rawCents = Number.isFinite(value) ? Math.round(value * 100) : 0;
    const clamped = Math.max(0, Math.min(maxCents, rawCents));
    setRows((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        amountText: dollars,
        amountCents: clamped,
      },
    }));
  };

  const toggle = (itemId: string) =>
    setRows((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], selected: !prev[itemId]?.selected },
    }));

  const fillMax = () => {
    if (!order) return;
    const next: Record<string, RefundRow> = {};
    for (const item of order.items) {
      const remaining = itemRemainingRefundable(item);
      next[item.id] = {
        selected: remaining > 0,
        amountText: (remaining / 100).toFixed(2),
        amountCents: remaining,
      };
    }
    setRows(next);
  };

  return (
    <Dialog
      open={!!order}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Refund to store credit</DialogTitle>
          <DialogDescription>
            Pick the courses to refund and the credit amount for each. No money
            leaves the payment gateway — the student receives store credit only.
          </DialogDescription>
        </DialogHeader>

        {order && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <div className="text-muted-foreground">
                Refundable: {formatUsd(orderRemaining / 100)}{" "}
                <span className="text-xs">
                  (of {formatUsd(orderPool / 100)})
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={fillMax}
                disabled={submitting || orderRemaining === 0}
              >
                Refund all remaining
              </Button>
            </div>

            <div className="space-y-2 rounded-md border">
              {order.items.map((item) => {
                const row = rows[item.id];
                const remaining = itemRemainingRefundable(item);
                const alreadyRefunded = item.refundedCents;
                const disabled = remaining === 0;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 border-b p-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={!disabled && !!row?.selected}
                        onCheckedChange={() => toggle(item.id)}
                        disabled={disabled || submitting}
                        aria-label={`Include ${item.title}`}
                      />
                      <div>
                        <div className="text-sm font-medium">{item.title}</div>
                        <div className="text-xs text-muted-foreground">
                          Paid {formatUsd(item.priceCents / 100)}
                          {alreadyRefunded > 0 &&
                            ` · Refunded ${formatUsd(alreadyRefunded / 100)}`}
                          {disabled && " · fully refunded"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:justify-end">
                      <span className="text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={remaining / 100}
                        step="0.01"
                        value={row ? row.amountText : (remaining / 100).toFixed(2)}
                        onChange={(e) =>
                          setAmount(item.id, e.target.value, remaining)
                        }
                        disabled={disabled || !row?.selected || submitting}
                        className="h-8 w-24 text-right"
                      />
                      <span className="text-xs text-muted-foreground">
                        / {formatUsd(remaining / 100)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-md bg-muted/50 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Total store credit</span>
                <span className="text-lg font-bold">
                  {formatUsd(totalCents / 100)}
                </span>
              </div>
              {isFullRemainder ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Fully-refunded courses will lose access.
                </p>
              ) : totalCents > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Partial per-item refunds keep the student's course access.
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="refund-comment" className="mb-2 block text-sm font-medium">
                Reason (visible in credit history)
              </label>
              <Textarea
                id="refund-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Why is credit being issued?"
                rows={3}
                maxLength={500}
                disabled={submitting}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Minimum 3 characters.</span>
                <span>{comment.trim().length}/500</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() => {
              if (!order) return;
              const items = order.items
                .map((item) => {
                  const row = rows[item.id];
                  if (!row?.selected || row.amountCents <= 0) return null;
                  return { orderItemId: item.id, amountCents: row.amountCents };
                })
                .filter((x): x is { orderItemId: string; amountCents: number } => x !== null);
              onSubmit(items, comment.trim());
            }}
          >
            {submitting
              ? "Issuing…"
              : `Grant ${formatUsd(totalCents / 100)} credit`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CopyOrderId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      toast.success("Order ID copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onCopy}
            aria-label="Copy order ID"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          />
        }
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied" : "Copy ID"}</TooltipContent>
    </Tooltip>
  );
}
