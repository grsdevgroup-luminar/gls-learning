import { orders } from "@/lib/mock/orders";
import { formatUsd } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CreditCard, DollarSign, RotateCcw, ShoppingBag } from "lucide-react";

export default function AdminOrders() {
  const gross = orders.filter((o) => o.status === "paid").reduce((s, o) => s + o.total, 0);
  const refunds = orders.filter((o) => o.status === "refunded").length;

  const stats = [
    { icon: DollarSign, label: "Gross revenue", value: formatUsd(gross).replace(".00", "") },
    { icon: ShoppingBag, label: "Orders", value: orders.length },
    { icon: RotateCcw, label: "Refunds", value: refunds },
  ];

  const statusCls: Record<string, string> = {
    paid: "text-success", refunded: "text-destructive", failed: "text-muted-foreground",
  };

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
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><s.icon className="h-5 w-5" /></div>
              <div><div className="text-2xl font-bold leading-none">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="p-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Coupon</TableHead>
                <TableHead>Gateway</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="pr-6">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="pl-6">
                    <div className="font-mono text-xs">{o.id}</div>
                    <div className="text-xs text-muted-foreground">{o.date}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{o.studentName}</div>
                    <div className="text-xs text-muted-foreground">{o.country}</div>
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-sm">{o.items.map((i) => i.title).join(", ")}</TableCell>
                  <TableCell>{o.coupon ? <Badge variant="secondary">{o.coupon}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell><span className="inline-flex items-center gap-1 text-sm capitalize"><CreditCard className="h-3.5 w-3.5 text-muted-foreground" />{o.gateway}</span></TableCell>
                  <TableCell className="font-medium">{formatUsd(o.total)}</TableCell>
                  <TableCell className="pr-6"><Badge variant="outline" className={`capitalize ${statusCls[o.status]}`}>{o.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
