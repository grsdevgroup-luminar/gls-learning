"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, type OrderDto } from "@/lib/api/endpoints";
import { formatUsd } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CreditCard, DollarSign, RotateCcw, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

const statusCls: Record<string, string> = {
  PAID: "text-success",
  REFUNDED: "text-destructive",
  FAILED: "text-muted-foreground",
  PENDING: "text-warning",
};

export default function AdminOrders() {
  const qc = useQueryClient();

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: adminApi.orders,
  });

  const refundMutation = useMutation({
    mutationFn: (id: string) => adminApi.refundOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast.success("Refund issued");
    },
    onError: () => toast.error("Refund failed"),
  });

  const gross = (orders ?? [])
    .filter((o) => o.status === "PAID")
    .reduce((s, o) => s + o.totalCents, 0);
  const refundCount = (orders ?? []).filter((o) => o.status === "REFUNDED").length;

  const stats = [
    { icon: DollarSign, label: "Gross revenue", value: formatUsd(gross / 100).replace(".00", "") },
    { icon: ShoppingBag, label: "Orders", value: orders?.length ?? "—" },
    { icon: RotateCcw, label: "Refunds", value: refundCount },
  ];

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
              {isLoading ? (
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
                : (orders ?? []).map((o) => (
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
        <div className="font-mono text-xs">{order.id.slice(0, 12)}…</div>
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
