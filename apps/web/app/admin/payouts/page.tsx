"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api/endpoints";
import type { PayoutDto } from "@skillstream/shared";
import { formatUsd, relativeDate, initials } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Wallet, Clock, CheckCircle2 } from "lucide-react";

const statusCls: Record<string, string> = {
  REQUESTED: "text-warning",
  APPROVED: "text-primary",
  PAID: "text-success",
  REJECTED: "text-destructive",
};

export default function AdminPayouts() {
  const qc = useQueryClient();
  const { data: payouts, isLoading } = useQuery({
    queryKey: ["admin-payouts"],
    queryFn: () => api.adminPayouts(),
  });

  const mutationFor = (fn: (id: string) => Promise<PayoutDto>, msg: string) => ({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useMutation(mutationFor(api.approvePayout, "Payout approved"));
  const markPaid = useMutation(mutationFor(api.markPayoutPaid, "Marked as paid"));
  const reject = useMutation(mutationFor((id) => api.rejectPayout(id), "Payout rejected"));

  const rows = payouts ?? [];
  const open = rows.filter((p) => p.status === "REQUESTED" || p.status === "APPROVED");
  const stats = [
    { icon: Clock, label: "Awaiting action", value: open.length },
    {
      icon: Wallet,
      label: "Open amount",
      value: formatUsd(open.reduce((s, p) => s + p.amountCents, 0) / 100),
    },
    {
      icon: CheckCircle2,
      label: "Paid to date",
      value: formatUsd(
        rows.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amountCents, 0) / 100,
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground">
          Approve and settle instructor and sales-agent payout requests.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 pt-6">
              <s.icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">{s.label}</div>
                <div className="text-xl font-bold">{s.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-4">
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    No payout requests yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {initials(p.payeeName)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{p.payeeName}</div>
                          <div className="truncate text-xs text-muted-foreground">{p.payeeEmail}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.payeeType === "AGENT" ? "Sales agent" : "Instructor"}
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {formatUsd(p.amountCents / 100)}
                    </TableCell>
                    <TableCell className="max-w-50 truncate text-xs text-muted-foreground">
                      {p.method === "PAYPAL" ? "PayPal" : "Bank"}: {p.destination}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {relativeDate(p.requestedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusCls[p.status] ?? ""}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {(p.status === "REQUESTED" || p.status === "APPROVED") && (
                        <div className="flex justify-end gap-1.5">
                          {p.status === "REQUESTED" && (
                            <Button
                              size="sm" variant="outline" className="h-7 text-xs"
                              disabled={approve.isPending}
                              onClick={() => approve.mutate(p.id)}
                            >
                              Approve
                            </Button>
                          )}
                          <Button
                            size="sm" className="h-7 text-xs"
                            disabled={markPaid.isPending}
                            onClick={() => markPaid.mutate(p.id)}
                          >
                            Mark paid
                          </Button>
                          <Button
                            size="sm" variant="ghost" className="h-7 text-xs text-destructive"
                            disabled={reject.isPending}
                            onClick={() => reject.mutate(p.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
