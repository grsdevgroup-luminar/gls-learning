"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api/endpoints";
import type { PayoutMethod } from "@skillstream/shared";
import { formatUsd, relativeDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const statusCls: Record<string, string> = {
  REQUESTED: "text-warning",
  APPROVED: "text-primary",
  PAID: "text-success",
  REJECTED: "text-destructive",
};

/** Payout account + request + history. Role-agnostic: the API derives whether
 *  the caller is an instructor or a sales agent, so both portals reuse this. */
export function PayoutPanel() {
  const qc = useQueryClient();
  const { data: balance } = useQuery({
    queryKey: ["payouts", "balance"],
    queryFn: api.payoutBalance,
  });
  const { data: account } = useQuery({
    queryKey: ["payouts", "account"],
    queryFn: api.payoutAccount,
  });
  const { data: history } = useQuery({
    queryKey: ["payouts", "history"],
    queryFn: api.myPayouts,
  });

  const [editing, setEditing] = useState(false);
  const [method, setMethod] = useState<PayoutMethod>("PAYPAL");
  const [details, setDetails] = useState("");

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["payouts"] });

  const saveAccount = useMutation({
    mutationFn: () => api.setPayoutAccount({ method, details: details.trim() }),
    onSuccess: () => {
      toast.success("Payout account saved");
      setEditing(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const request = useMutation({
    mutationFn: () => api.requestPayout(),
    onSuccess: () => {
      toast.success("Payout requested — an admin will process it shortly");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!balance) return null;

  const showForm = editing || !balance.hasAccount;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payout balance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Figure label="Lifetime earned" value={balance.lifetimeEarnedCents} />
            <Figure label="Paid out" value={balance.paidOutCents} muted />
            <Figure label="In flight" value={balance.inFlightCents} muted />
            <Figure label="Available" value={balance.availableCents} accent />
          </div>

          {!showForm && account && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3 text-sm">
              <div>
                <span className="font-medium">
                  {account.method === "PAYPAL" ? "PayPal" : "Bank transfer"}
                </span>
                <span className="ml-2 text-muted-foreground">{account.details}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            </div>
          )}

          {showForm && (
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-medium">
                {balance.hasAccount ? "Update payout account" : "Add a payout account"}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Select value={method} onValueChange={(v) => setMethod(v as PayoutMethod)}>
                  <SelectTrigger className="sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAYPAL">PayPal</SelectItem>
                    <SelectItem value="BANK">Bank transfer</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder={method === "PAYPAL" ? "PayPal email" : "Bank / IBAN details"}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="flex-1"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={details.trim().length < 3 || saveAccount.isPending}
                  onClick={() => saveAccount.mutate()}
                >
                  Save
                </Button>
                {balance.hasAccount && (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-4">
            <p className="text-sm text-muted-foreground">
              {balance.hasOpenRequest
                ? "You have a payout in progress."
                : balance.availableCents < balance.minPayoutCents
                  ? `Minimum payout is ${formatUsd(balance.minPayoutCents / 100)}.`
                  : `${formatUsd(balance.availableCents / 100)} ready to withdraw.`}
            </p>
            <Button
              disabled={!balance.canRequest || request.isPending}
              onClick={() => request.mutate()}
            >
              Request payout
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payout history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(history ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    No payouts yet.
                  </TableCell>
                </TableRow>
              ) : (
                history!.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium tabular-nums">
                      {formatUsd(p.amountCents / 100)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.method === "PAYPAL" ? "PayPal" : "Bank"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {relativeDate(p.requestedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusCls[p.status] ?? ""}>
                        {p.status}
                      </Badge>
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

function Figure({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: number;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 text-xl font-bold tabular-nums ${
          accent ? "text-success" : muted ? "text-muted-foreground" : ""
        }`}
      >
        {formatUsd(value / 100)}
      </div>
    </div>
  );
}
