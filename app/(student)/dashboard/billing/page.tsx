"use client";

import { orders } from "@/lib/mock/orders";
import { demoStudent } from "@/lib/mock/students";
import { formatUsd } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CreditCard, Download, Receipt, Plus } from "lucide-react";

export default function BillingPage() {
  const myOrders = orders.filter((o) => o.studentEmail === demoStudent.email);
  // fall back to a couple of sample orders so the table isn't empty
  const rows = myOrders.length ? myOrders : orders.slice(0, 3);

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">Manage your payment methods and view past purchases.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-primary" /> Purchase history
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="pr-6 text-right">Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="pl-6 font-mono text-xs">{o.id}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{o.date}</TableCell>
                    <TableCell className="text-sm">
                      {o.items[0].title}
                      {o.items.length > 1 && <span className="text-muted-foreground"> +{o.items.length - 1}</span>}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatUsd(o.total)}
                      {o.status === "refunded" && <Badge variant="secondary" className="ml-2 text-destructive">Refunded</Badge>}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button size="sm" variant="ghost"><Download className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Payment methods</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="grid h-9 w-12 place-items-center rounded bg-primary/10 text-primary"><CreditCard className="h-5 w-5" /></div>
                <div className="flex-1">
                  <div className="text-sm font-medium">Visa •••• 4242</div>
                  <div className="text-xs text-muted-foreground">Expires 08/27</div>
                </div>
                <Badge variant="secondary">Default</Badge>
              </div>
              <Button variant="outline" className="w-full"><Plus /> Add payment method</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Total spent</CardTitle></CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatUsd(demoStudent.totalSpent)}</div>
              <p className="text-xs text-muted-foreground">across {rows.length} orders</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
