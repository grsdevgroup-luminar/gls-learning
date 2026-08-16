"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, type OrderDto } from "@/lib/api/endpoints";
import { formatUsd } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  DollarSign,
  RotateCcw,
  Search,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const statusCls: Record<string, string> = {
  PAID: "text-success",
  REFUNDED: "text-destructive",
  FAILED: "text-muted-foreground",
  PENDING: "text-warning",
};

export default function AdminOrders() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");

  // Debounce search box so every keystroke doesn't hit the API.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const { data: orderPage, isLoading, error } = useQuery({
    queryKey: ["admin", "orders", "list", { q, page, pageSize }],
    queryFn: () =>
      adminApi.orders({ q: q || undefined, page, pageSize }),
    placeholderData: (prev) => prev,
  });

  const { data: orderStats } = useQuery({
    queryKey: ["admin", "orders", "stats"],
    queryFn: adminApi.orderStats,
  });

  const pagedOrders = orderPage?.items ?? [];
  const totalPages = orderPage?.totalPages ?? 1;

  useEffect(() => {
    if (orderPage && page > orderPage.totalPages) setPage(orderPage.totalPages);
  }, [orderPage, page]);

  const refundMutation = useMutation({
    mutationFn: (id: string) => adminApi.refundOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast.success("Refund issued");
    },
    onError: () => toast.error("Refund failed"),
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
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">Transactions across Stripe and PayPal.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search by order id, coupon, user, item…"
            className="pl-9"
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

      {error && (
        <p className="text-sm text-destructive">Failed to load orders.</p>
      )}

      <Card className="p-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Order</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Coupon</TableHead>
                <TableHead>Gateway</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? [...Array(5)].map((_, i) => (
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
                      onRefund={() => refundMutation.mutate(o.id)}
                      refunding={refundMutation.isPending && refundMutation.variables === o.id}
                    />
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
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
  return (
    <TableRow>
      <TableCell className="pl-6">
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger
              render={<span />}
              className="cursor-default font-mono text-xs"
            >
              {order.id.slice(0, 12)}…
            </TooltipTrigger>
            <TooltipContent>
              <span className="font-mono text-xs">{order.id}</span>
            </TooltipContent>
          </Tooltip>
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
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={`capitalize ${statusCls[order.status] ?? ""}`}
        >
          {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
        </Badge>
      </TableCell>
      <TableCell className="pr-6 text-right">
        {order.status === "PAID" && (
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
