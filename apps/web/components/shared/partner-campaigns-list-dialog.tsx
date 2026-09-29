"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeliveryPartnerCampaignDto, PartnerCampaignStatus } from "@skillstream/shared";
import { adminApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { Meter } from "@/components/shared/meter";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CampaignFormDialog } from "@/components/shared/campaign-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Megaphone, Copy, PauseCircle, Trash2, Search, Plus, Pencil, Info,
} from "lucide-react";
import { toast } from "sonner";

const statusStyle: Record<PartnerCampaignStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "text-success" },
  scheduled: { label: "Scheduled", className: "text-primary" },
  disabled: { label: "Disabled", className: "text-muted-foreground" },
  expired: { label: "Expired", className: "text-muted-foreground" },
  "limit-reached": { label: "Limit reached", className: "text-warning" },
};

/**
 * Admin-only: browse every discount + commission campaign a delivery
 * partner holds — a partner can run any number at once, including several
 * active ones with overlapping dates (each is redeemed by its own distinct
 * code, so there's no ambiguity at checkout). Purely a list + row actions;
 * creating/editing a single campaign happens in the separate, focused
 * CampaignFormDialog (opened from here), not inline in this dialog.
 */
export function PartnerCampaignsListDialog({
  partnerId,
  partnerName,
}: {
  partnerId: string;
  partnerName: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PartnerCampaignStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryPartnerCampaignDto | undefined>(undefined);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["admin", "delivery-partners", partnerId, "campaigns"],
    queryFn: () => adminApi.partnerCampaigns(partnerId),
    enabled: open,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "delivery-partners", partnerId, "campaigns"] });
  };

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
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all
      .filter((c) => statusFilter === "all" || c.status === statusFilter)
      .filter((c) => !q || c.code.toLowerCase().includes(q));
  }, [all, search, statusFilter]);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) { setSearch(""); setStatusFilter("all"); }
        }}
      >
        <DialogTrigger render={<Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" />}>
          <Megaphone className="h-3 w-3" /> Campaigns
        </DialogTrigger>
        <DialogContent className="flex h-[min(680px,calc(100vh-2rem))] w-[calc(100vw-2rem)] !max-w-none flex-col sm:w-[min(680px,calc(100vw-3rem))] sm:min-w-[560px]">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <DialogTitle>{partnerName} — campaigns</DialogTitle>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"
                        aria-label="About campaigns"
                      />
                    }
                  >
                    <Info className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-left leading-relaxed" side="bottom" align="start">
                    Time-boxed discount codes, applicable to every course or a chosen subset. Buyers apply one at
                    checkout instead of a coupon; {partnerName} earns their usual commission on the discounted total.
                    A partner can hold any number of campaigns at once, even with overlapping dates — each has its
                    own code, so buyers just use the one they were given.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => { setEditing(undefined); setFormOpen(true); }}
              >
                <Plus className="h-3.5 w-3.5" /> New campaign
              </Button>
            </div>
          </DialogHeader>

          <div className="mb-1 flex shrink-0 flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by code…"
                className="search-input h-8 border-input bg-background pl-8 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:bg-input/30"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v as PartnerCampaignStatus | "all")}>
              <SelectTrigger className="h-8 w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value="all">All statuses</SelectItem>
                {(["active", "scheduled", "limit-reached", "expired", "disabled"] as const).map((s) => (
                  <SelectItem key={s} value={s}>{statusStyle[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)
            ) : all.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
                <Megaphone className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No campaigns yet — create one above.</p>
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No campaigns match this search/filter.</p>
            ) : (
              filtered.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border p-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-semibold">{c.code}</span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Copy code"
                      onClick={() => { navigator.clipboard?.writeText(c.code); toast.success("Code copied"); }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Badge variant="outline" className={statusStyle[c.status].className}>
                    {statusStyle[c.status].label}
                  </Badge>
                  <div className="flex items-center gap-1 text-sm font-semibold">
                    {c.discountPercent}%
                  </div>
                  <Badge variant="secondary" className="text-xs font-normal">
                    {c.scope === "SPECIFIC" ? `${c.courses.length} course${c.courses.length === 1 ? "" : "s"}` : "All courses"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {c.startDate.slice(0, 10)} → {c.endDate.slice(0, 10)}
                  </span>
                  {c.usageLimit > 0 && (
                    <div className="flex min-w-[140px] flex-1 items-center gap-2">
                      <Meter value={(c.usageCount / c.usageLimit) * 100} height={6} className="flex-1" />
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {c.usageCount.toLocaleString()}/{c.usageLimit.toLocaleString()} seats
                      </span>
                    </div>
                  )}
                  <div className="ml-auto flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => { setEditing(c); setFormOpen(true); }}
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    {c.active && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={deactivateMutation.isPending}
                        onClick={() => deactivateMutation.mutate(c.id)}
                      >
                        <PauseCircle className="h-3 w-3" /> Deactivate
                      </Button>
                    )}
                    {c.usageCount === 0 && (
                      <ConfirmDialog
                        trigger={
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive">
                            <Trash2 className="h-3 w-3" /> Delete
                          </Button>
                        }
                        title={`Delete campaign "${c.code}"?`}
                        description="This can't be undone."
                        pending={deleteMutation.isPending}
                        onConfirm={() => deleteMutation.mutate(c.id)}
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CampaignFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        partnerId={partnerId}
        partnerName={partnerName}
        campaign={editing}
      />
    </>
  );
}
