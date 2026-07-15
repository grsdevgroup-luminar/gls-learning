"use client";

import { useMyOrders } from "@/lib/api/hooks";
import { formatUsd } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CreditCard, Download, Receipt, Plus } from "lucide-react";

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

export default function BillingPage() {
  const { data: orders, isLoading, isError } = useMyOrders();

  const rows = orders ?? [];
  const totalSpent = rows
    .filter((o) => o.status === "PAID")
    .reduce((sum, o) => sum + o.totalCents / 100, 0);

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">Manage your payment methods and view past purchases.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Purchase history */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-primary" /> Purchase history
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
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
                No purchases yet.
              </p>
            ) : (
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
                  {rows.map((o) => {
                    const badge = STATUS_BADGE[o.status] ?? STATUS_BADGE.PENDING;
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="pl-6 font-mono text-xs">
                          {o.id.slice(0, 8)}…
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
                          <Button size="sm" variant="ghost" disabled={o.status !== "PAID"}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Payment methods</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="grid h-9 w-12 place-items-center rounded bg-primary/10 text-primary">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">Visa •••• 4242</div>
                  <div className="text-xs text-muted-foreground">Expires 08/27</div>
                </div>
                <Badge variant="secondary">Default</Badge>
              </div>
              <Button variant="outline" className="w-full">
                <Plus /> Add payment method
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Total spent</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-9 w-28" />
              ) : (
                <>
                  <div className="text-3xl font-bold">{formatUsd(totalSpent)}</div>
                  <p className="text-xs text-muted-foreground">
                    across {rows.filter((o) => o.status === "PAID").length} paid order{rows.filter((o) => o.status === "PAID").length !== 1 ? "s" : ""}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
