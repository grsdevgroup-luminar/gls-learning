"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api/endpoints";
import type { PayoutDto, PayoutStatus } from "@skillstream/shared";
import { formatUsd, relativeDate, initials } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Wallet, Clock, CheckCircle2, Search, X, Info } from "lucide-react";

const statusCls: Record<string, string> = {
  REQUESTED: "text-warning",
  APPROVED: "text-primary",
  PAID: "text-success",
  REJECTED: "text-destructive",
};

type Preset = "all" | "today" | "thisWeek" | "thisMonth" | "custom";

const presets: { key: Preset; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "thisWeek", label: "This week" },
  { key: "thisMonth", label: "This month" },
  { key: "custom", label: "Custom" },
];

/** Local-time day boundaries. `from` = 00:00, `to` = 23:59:59.999. */
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
/** Week starts Monday. */
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  return x;
}
function endOfWeek(d: Date) {
  const x = startOfWeek(d);
  x.setDate(x.getDate() + 6);
  return endOfDay(x);
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function rangeFor(
  preset: Preset,
  customFrom: string,
  customTo: string,
): { from?: string; to?: string } {
  const now = new Date();
  switch (preset) {
    case "all":
      return {};
    case "today":
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
    case "thisWeek":
      return { from: startOfWeek(now).toISOString(), to: endOfWeek(now).toISOString() };
    case "thisMonth":
      return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() };
    case "custom":
      return {
        from: customFrom ? startOfDay(new Date(customFrom)).toISOString() : undefined,
        to: customTo ? endOfDay(new Date(customTo)).toISOString() : undefined,
      };
  }
}

export default function AdminPayouts() {
  const qc = useQueryClient();

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<PayoutStatus | "ALL">("ALL");
  const [preset, setPreset] = useState<Preset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Debounce the search input so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const range = useMemo(
    () => rangeFor(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const params = useMemo(
    () => ({
      status: status === "ALL" ? undefined : status,
      q: q || undefined,
      from: range.from,
      to: range.to,
    }),
    [status, q, range.from, range.to],
  );

  const { data: payouts, isLoading } = useQuery({
    queryKey: ["admin-payouts", params],
    queryFn: () => api.adminPayouts(params),
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

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => api.rejectPayout(id, note),
    onSuccess: () => {
      toast.success("Payout rejected");
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      setRejectingId(null);
      setRejectReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  const hasActiveFilters =
    !!q || status !== "ALL" || preset !== "all";

  const clearAll = () => {
    setQInput("");
    setQ("");
    setStatus("ALL");
    setPreset("all");
    setCustomFrom("");
    setCustomTo("");
  };

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground">
          Approve and settle instructor and delivery-partner payout requests.
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
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Search payee name, email, or destination"
                className="search-input border-input bg-background pl-8 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:bg-input/30"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as PayoutStatus | "ALL")}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="REQUESTED">Requested</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-9 gap-1 text-xs"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {presets.map((p) => (
              <Button
                key={p.key}
                variant={preset === p.key ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setPreset(p.key)}
              >
                {p.label}
              </Button>
            ))}
            {preset === "custom" && (
              <div className="ml-1 flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-8 w-[9.5rem]"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-8 w-[9.5rem]"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
                    {hasActiveFilters
                      ? "No payouts match your filters."
                      : "No payout requests yet."}
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
                      {p.payeeType === "DELIVERY_PARTNER" ? "Delivery partner" : "Instructor"}
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {formatUsd(p.amountCents / 100)}
                    </TableCell>
                    <TableCell className="max-w-50 truncate text-xs text-muted-foreground">
                      {p.method === "PAYPAL" ? "PayPal" : p.method === "STRIPE" ? "Stripe" : "Bank"}: {p.destination}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {relativeDate(p.requestedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={statusCls[p.status] ?? ""}>
                          {p.status}
                        </Badge>
                        {p.status === "REJECTED" && p.note && (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <button
                                  type="button"
                                  className="text-muted-foreground"
                                  aria-label="Rejection reason"
                                />
                              }
                            >
                              <Info className="size-3.5" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-64">{p.note}</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
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
                            onClick={() => setRejectingId(p.id)}
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

      <Dialog
        open={!!rejectingId}
        onOpenChange={(open) => {
          setRejectingId(open ? rejectingId : null);
          if (!open) setRejectReason("");
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg overflow-hidden">
          <DialogHeader>
            <DialogTitle>Reject payout</DialogTitle>
          </DialogHeader>
          <div className="mt-2 w-full space-y-4">
            <div className="space-y-1">
              <label htmlFor="payout-rejection-reason" className="text-sm font-medium">Rejection reason</label>
              <Textarea
                id="payout-rejection-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this payout wasn't approved — the payee will see this."
                className="min-h-24 w-full resize-y"
              />
            </div>
            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setRejectingId(null)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                className="w-full text-destructive sm:w-auto"
                disabled={!rejectReason.trim() || reject.isPending}
                onClick={() => rejectingId && reject.mutate({ id: rejectingId, note: rejectReason.trim() })}
              >
                <X /> Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
