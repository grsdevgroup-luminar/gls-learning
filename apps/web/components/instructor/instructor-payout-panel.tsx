"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, ExternalLink, Info } from "lucide-react";
import { api } from "@/lib/api/endpoints";
import { formatUsd, relativeDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const statusCls: Record<string, string> = {
  REQUESTED: "text-warning",
  APPROVED: "text-primary",
  PAID: "text-success",
  REJECTED: "text-destructive",
};

/**
 * Instructor-only payout panel wired to Stripe Connect Express.
 *
 * Flow:
 *   1. Instructor clicks "Connect with Stripe" → server mints an `acct_xxx`
 *      (if new) + hosted onboarding link → we redirect to Stripe.
 *   2. Stripe redirects back to `/instructor/earnings?stripe=onboarded`.
 *      We refetch status; when `payoutsEnabled` is true the "Withdraw" button
 *      becomes usable.
 *   3. "Withdraw" opens a modal with a live fee quote and confirms the payout.
 */
export function InstructorPayoutPanel() {
  const qc = useQueryClient();

  const { data: balance } = useQuery({
    queryKey: ["payouts", "balance"],
    queryFn: api.payoutBalance,
  });
  const { data: stripeStatus } = useQuery({
    queryKey: ["payouts", "stripe-status"],
    queryFn: api.stripeAccountStatus,
    // Poll briefly after returning from onboarding so the UI catches up to
    // Stripe finishing verification.
    refetchInterval: (query) =>
      query.state.data?.payoutsEnabled ? false : 3000,
  });
  const { data: history } = useQuery({
    queryKey: ["payouts", "history"],
    queryFn: api.myPayouts,
  });

  const invalidateAll = () =>
    qc.invalidateQueries({ queryKey: ["payouts"] });

  const connect = useMutation({
    mutationFn: api.stripeOnboardLink,
    onSuccess: (link) => {
      // Full page redirect — Stripe's hosted onboarding needs the top window.
      window.location.href = link.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [modalOpen, setModalOpen] = useState(false);

  // Auto-refetch on return from Stripe onboarding (?stripe=onboarded).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("stripe")) invalidateAll();
    // Deliberately no dep on invalidateAll — we only care about mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!balance) return null;

  const canWithdraw =
    !!stripeStatus?.payoutsEnabled &&
    !balance.hasOpenRequest &&
    balance.availableCents >= balance.minPayoutCents;

  return (
    <div className="space-y-6">
      <StripeConnectCard
        status={stripeStatus}
        connecting={connect.isPending}
        onConnect={() => connect.mutate()}
      />

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

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              {balance.hasOpenRequest
                ? "You have a payout in progress."
                : !stripeStatus?.payoutsEnabled
                  ? "Connect Stripe to enable withdrawals."
                  : balance.availableCents < balance.minPayoutCents
                    ? `Minimum payout is ${formatUsd(balance.minPayoutCents / 100)}.`
                    : `${formatUsd(balance.availableCents / 100)} ready to withdraw.`}
            </p>
            <Button disabled={!canWithdraw} onClick={() => setModalOpen(true)}>
              Withdraw
            </Button>
          </div>
        </CardContent>
      </Card>

      <PayoutHistoryCard history={history ?? []} />

      <WithdrawModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        availableCents={balance.availableCents}
        minPayoutCents={balance.minPayoutCents}
        onSuccess={invalidateAll}
      />
    </div>
  );
}

// ── Stripe connect card ────────────────────────────────────────────────────

function StripeConnectCard({
  status,
  connecting,
  onConnect,
}: {
  status: Awaited<ReturnType<typeof api.stripeAccountStatus>> | undefined;
  connecting: boolean;
  onConnect: () => void;
}) {
  if (!status) return null;
  const ready = status.payoutsEnabled;
  const needsMore =
    status.connected && (!status.detailsSubmitted || status.requirementsDue.length > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Stripe payout account</CardTitle>
        {ready ? (
          <Badge variant="outline" className="text-success">
            <CheckCircle2 className="mr-1 size-3.5" />
            Ready
          </Badge>
        ) : status.connected ? (
          <Badge variant="outline" className="text-warning">
            <AlertCircle className="mr-1 size-3.5" />
            Verification needed
          </Badge>
        ) : (
          <Badge variant="outline">Not connected</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!status.connected && (
          <p className="text-sm text-muted-foreground">
            Connect your Stripe account to receive payouts. Stripe hosts the
            onboarding — your bank details never touch our servers.
          </p>
        )}
        {status.connected && (
          <p className="text-sm text-muted-foreground">
            Connected account{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {maskAccount(status.connectedAccountId)}
            </code>
          </p>
        )}
        {needsMore && status.requirementsDue.length > 0 && (
          <ul className="list-inside list-disc text-xs text-warning">
            {status.requirementsDue.slice(0, 5).map((r) => (
              <li key={r}>{r.replace(/[_.]/g, " ")}</li>
            ))}
          </ul>
        )}
        <div>
          <Button
            size="sm"
            variant={ready ? "outline" : "default"}
            disabled={connecting}
            onClick={onConnect}
          >
            {ready
              ? "Update Stripe details"
              : status.connected
                ? "Complete verification"
                : "Connect with Stripe"}
            <ExternalLink className="ml-1.5 size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function maskAccount(id: string | null): string {
  if (!id) return "—";
  return id.length <= 8 ? id : `${id.slice(0, 6)}…${id.slice(-4)}`;
}

// ── Withdraw modal ─────────────────────────────────────────────────────────

function WithdrawModal({
  open,
  onOpenChange,
  availableCents,
  minPayoutCents,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  availableCents: number;
  minPayoutCents: number;
  onSuccess: () => void;
}) {
  const [amountUsd, setAmountUsd] = useState<string>("");

  useEffect(() => {
    if (open) setAmountUsd((availableCents / 100).toFixed(2));
  }, [open, availableCents]);

  const amountCents = useMemo(() => {
    const n = Number(amountUsd);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 100);
  }, [amountUsd]);

  const withinRange =
    amountCents >= minPayoutCents && amountCents <= availableCents;

  const { data: quote, isFetching: quoting } = useQuery({
    queryKey: ["payouts", "quote", amountCents],
    queryFn: () => api.quotePayout(amountCents),
    enabled: open && withinRange,
    staleTime: 15_000,
  });

  const request = useMutation({
    mutationFn: () => api.requestPayout(amountCents),
    onSuccess: () => {
      toast.success("Payout requested");
      onSuccess();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disabled =
    !withinRange || quoting || !quote?.meetsMinimum || request.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw funds</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="withdraw-amount">Amount (USD)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="withdraw-amount"
                type="number"
                step="0.01"
                min={minPayoutCents / 100}
                max={availableCents / 100}
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                className="pl-7"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Available: {formatUsd(availableCents / 100)}. Minimum:{" "}
              {formatUsd(minPayoutCents / 100)}.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <BreakdownRow label="Requested" value={amountCents} />
            <BreakdownRow
              label="Platform fee"
              value={-(quote?.platformFeeCents ?? 0)}
              muted
            />
            <BreakdownRow
              label="Stripe fee"
              value={-(quote?.stripeFeeCents ?? 0)}
              muted
            />
            <div className="my-1.5 border-t" />
            <BreakdownRow
              label="You receive"
              value={quote?.netCents ?? 0}
              accent
            />
            {quote && !quote.meetsMinimum && (
              <p className="mt-2 text-xs text-destructive">
                Net is below the ${(quote.minNetCents / 100).toFixed(2)} minimum.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={disabled} onClick={() => request.mutate()}>
            Confirm withdrawal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BreakdownRow({
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
  const sign = value < 0 ? "-" : "";
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span
        className={`tabular-nums ${
          accent ? "font-semibold text-success" : muted ? "text-muted-foreground" : ""
        }`}
      >
        {sign}
        {formatUsd(Math.abs(value) / 100)}
      </span>
    </div>
  );
}

// ── History ─────────────────────────────────────────────────────────────────

function PayoutHistoryCard({
  history,
}: {
  history: Awaited<ReturnType<typeof api.myPayouts>>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payout history</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Amount</TableHead>
              <TableHead>Net</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-muted-foreground"
                >
                  No payouts yet.
                </TableCell>
              </TableRow>
            ) : (
              history.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium tabular-nums">
                    {formatUsd(p.amountCents / 100)}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatUsd(p.netCents / 100)}
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
                  <TableCell className="text-muted-foreground">
                    {p.providerRef ? (
                      <a
                        href={`https://dashboard.stripe.com/transfers/${p.providerRef}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {p.providerRef.slice(0, 12)}…
                        <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Balance figure ──────────────────────────────────────────────────────────

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
