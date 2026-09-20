"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PartnerCampaignStatus } from "@skillstream/shared";
import { adminApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { Meter } from "@/components/shared/meter";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { Megaphone, Copy, PauseCircle, Trash2, Percent } from "lucide-react";
import { toast } from "sonner";

const statusStyle: Record<PartnerCampaignStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "text-success" },
  scheduled: { label: "Scheduled", className: "text-primary" },
  disabled: { label: "Disabled", className: "text-muted-foreground" },
  expired: { label: "Expired", className: "text-muted-foreground" },
  "limit-reached": { label: "Limit reached", className: "text-warning" },
};

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Admin-only: create and manage a delivery partner's discount + commission
 * campaign — a time-boxed code applicable to all courses. At most one
 * currently-usable (active/scheduled/limit-reached) campaign per partner —
 * the server enforces this, this dialog just reflects it: a "current"
 * campaign card replaces the create form until it's deactivated.
 */
export function ManagePartnerCampaignDialog({
  partnerId,
  partnerName,
}: {
  partnerId: string;
  partnerName: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [discountPercent, setDiscountPercent] = useState("20");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState("");
  const [usageLimit, setUsageLimit] = useState("0");

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["admin", "delivery-partners", partnerId, "campaigns"],
    queryFn: () => adminApi.partnerCampaigns(partnerId),
    enabled: open,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "delivery-partners", partnerId, "campaigns"] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      adminApi.createPartnerCampaign(partnerId, {
        discountPercent: Number(discountPercent),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        usageLimit: Number(usageLimit) || 0,
      }),
    onSuccess: (c) => {
      toast.success(`Campaign created — code ${c.code}`);
      setDiscountPercent("20");
      setUsageLimit("0");
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deactivateMutation = useMutation({
    mutationFn: (campaignId: string) =>
      adminApi.updatePartnerCampaign(partnerId, campaignId, { active: false }),
    onSuccess: () => { toast.success("Campaign deactivated"); invalidate(); },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (campaignId: string) => adminApi.deletePartnerCampaign(partnerId, campaignId),
    onSuccess: () => { toast.success("Campaign deleted"); invalidate(); },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const all = campaigns ?? [];
  const current = all.find(
    (c) => c.status === "active" || c.status === "scheduled" || c.status === "limit-reached",
  );
  const history = all.filter((c) => c.id !== current?.id);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setDiscountPercent("20");
          setUsageLimit("0");
          setStartDate(todayIso());
          setEndDate("");
        }
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" />}>
        <Megaphone className="h-3 w-3" /> Campaign
      </DialogTrigger>
      <DialogContent className="max-h-[min(760px,calc(100vh-2rem))] overflow-y-auto sm:w-[min(520px,calc(100vw-3rem))]">
        <DialogHeader>
          <DialogTitle>{partnerName} — referral campaign</DialogTitle>
          <DialogDescription>
            A time-boxed discount code, applicable to every course. Buyers apply it at checkout instead of a coupon;{" "}
            {partnerName} earns their usual commission on the discounted total.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {isLoading ? (
            <Skeleton className="h-28 rounded-lg" />
          ) : current ? (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-base font-semibold">{current.code}</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className={statusStyle[current.status].className}>
                    {statusStyle[current.status].label}
                  </Badge>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Copy code"
                    onClick={() => { navigator.clipboard?.writeText(current.code); toast.success("Code copied"); }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-2xl font-bold">
                <Percent className="h-5 w-5 text-primary" /> {current.discountPercent}%
                <span className="text-sm font-normal text-muted-foreground">off, for {partnerName}&apos;s commission</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {current.startDate.slice(0, 10)} → {current.endDate.slice(0, 10)}
              </p>
              {current.usageLimit > 0 && (
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>{current.usageCount.toLocaleString()} / {current.usageLimit.toLocaleString()} used</span>
                    <span>{Math.round((current.usageCount / current.usageLimit) * 100)}%</span>
                  </div>
                  <Meter value={(current.usageCount / current.usageLimit) * 100} height={6} />
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={deactivateMutation.isPending}
                onClick={() => deactivateMutation.mutate(current.id)}
              >
                <PauseCircle className="h-3.5 w-3.5" /> Deactivate
              </Button>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                New campaign
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Discount %</Label>
                  <Input
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Redemption cap</Label>
                  <Input
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    inputMode="numeric"
                    placeholder="0 = unlimited"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>End date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <Button
                className="w-full"
                disabled={createMutation.isPending}
                onClick={() => {
                  const pct = Number(discountPercent);
                  if (!pct || pct <= 0 || pct > 100) return toast.error("Discount must be between 1 and 100");
                  if (!endDate) return toast.error("Pick an end date");
                  if (new Date(endDate) <= new Date(startDate)) return toast.error("End date must be after the start date");
                  createMutation.mutate();
                }}
              >
                <Megaphone className="h-4 w-4" /> Create campaign
              </Button>
            </div>
          )}

          {history.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                History
              </p>
              <div className="space-y-2">
                {history.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{c.code}</span>
                        <Badge variant="outline" className={statusStyle[c.status].className}>
                          {statusStyle[c.status].label}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.discountPercent}% off · {c.startDate.slice(0, 10)} → {c.endDate.slice(0, 10)} ·{" "}
                        {c.usageCount.toLocaleString()} used{c.usageLimit > 0 ? ` / ${c.usageLimit.toLocaleString()}` : ""}
                      </div>
                    </div>
                    {c.usageCount === 0 && (
                      <ConfirmDialog
                        trigger={
                          <Button size="icon-sm" variant="ghost" className="shrink-0 text-destructive" aria-label="Delete campaign">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        }
                        title={`Delete campaign "${c.code}"?`}
                        description="This can't be undone."
                        pending={deleteMutation.isPending}
                        onConfirm={() => deleteMutation.mutate(c.id)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
