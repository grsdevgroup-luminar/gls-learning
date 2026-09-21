"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeliveryPartnerCampaignDto, PartnerCampaignStatus } from "@skillstream/shared";
import { adminApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { Meter } from "@/components/shared/meter";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Megaphone, Copy, PauseCircle, Trash2, Percent, Search, Plus, Pencil, X,
} from "lucide-react";
import { toast } from "sonner";

const statusStyle: Record<PartnerCampaignStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "text-success" },
  scheduled: { label: "Scheduled", className: "text-primary" },
  disabled: { label: "Disabled", className: "text-muted-foreground" },
  expired: { label: "Expired", className: "text-muted-foreground" },
  "limit-reached": { label: "Limit reached", className: "text-warning" },
};

const STATUS_FILTERS = ["all", "active", "scheduled", "limit-reached", "expired", "disabled"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const todayIso = () => new Date().toISOString().slice(0, 10);

type FormState = {
  discountPercent: string;
  usageLimit: string;
  startDate: string;
  endDate: string;
  active: boolean;
};

const emptyForm = (): FormState => ({
  discountPercent: "20",
  usageLimit: "0",
  startDate: todayIso(),
  endDate: "",
  active: true,
});

/**
 * Admin-only: create, edit, and manage every discount + commission campaign
 * a delivery partner holds — a partner can run several at once (the server's
 * only rule is no two *active* campaigns with overlapping dates), so this
 * lists all of them with search/status filtering rather than showing a
 * single "current" slot.
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["admin", "delivery-partners", partnerId, "campaigns"],
    queryFn: () => adminApi.partnerCampaigns(partnerId),
    enabled: open,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "delivery-partners", partnerId, "campaigns"] });
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const startEdit = (c: DeliveryPartnerCampaignDto) => {
    setEditingId(c.id);
    setForm({
      discountPercent: String(c.discountPercent),
      usageLimit: String(c.usageLimit),
      startDate: c.startDate.slice(0, 10),
      endDate: c.endDate.slice(0, 10),
      active: c.active,
    });
    setFormOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      adminApi.createPartnerCampaign(partnerId, {
        discountPercent: Number(form.discountPercent),
        startDate: new Date(form.startDate),
        endDate: new Date(form.endDate),
        usageLimit: Number(form.usageLimit) || 0,
      }),
    onSuccess: (c) => {
      toast.success(`Campaign created — code ${c.code}`);
      closeForm();
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (campaignId: string) =>
      adminApi.updatePartnerCampaign(partnerId, campaignId, {
        discountPercent: Number(form.discountPercent),
        startDate: new Date(form.startDate),
        endDate: new Date(form.endDate),
        usageLimit: Number(form.usageLimit) || 0,
        active: form.active,
      }),
    onSuccess: () => {
      toast.success("Campaign updated");
      closeForm();
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

  const saving = createMutation.isPending || updateMutation.isPending;

  function submitForm() {
    const pct = Number(form.discountPercent);
    if (!pct || pct <= 0 || pct > 100) return toast.error("Discount must be between 1 and 100");
    if (!form.endDate) return toast.error("Pick an end date");
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      return toast.error("End date must be after the start date");
    }
    if (editingId) updateMutation.mutate(editingId);
    else createMutation.mutate();
  }

  const all = campaigns ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all
      .filter((c) => statusFilter === "all" || c.status === statusFilter)
      .filter((c) => !q || c.code.toLowerCase().includes(q));
  }, [all, search, statusFilter]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) { setSearch(""); setStatusFilter("all"); closeForm(); }
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" />}>
        <Megaphone className="h-3 w-3" /> Campaigns
      </DialogTrigger>
      <DialogContent className="flex h-[min(760px,calc(100vh-2rem))] flex-col sm:w-[min(720px,calc(100vw-3rem))]">
        <DialogHeader>
          <DialogTitle>{partnerName} — campaigns</DialogTitle>
          <DialogDescription>
            Time-boxed discount codes, applicable to every course. Buyers apply one at checkout instead of a coupon;{" "}
            {partnerName} earns their usual commission on the discounted total. A partner can hold several campaigns
            at once, as long as no two active ones overlap in date.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {formOpen ? (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {editingId ? "Edit campaign" : "New campaign"}
                </p>
                <Button size="icon-sm" variant="ghost" aria-label="Cancel" onClick={closeForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Discount %</Label>
                  <Input
                    value={form.discountPercent}
                    onChange={(e) => setForm((p) => ({ ...p, discountPercent: e.target.value }))}
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Seat cap</Label>
                  <Input
                    value={form.usageLimit}
                    onChange={(e) => setForm((p) => ({ ...p, usageLimit: e.target.value }))}
                    inputMode="numeric"
                    placeholder="0 = unlimited"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>End date</Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                  />
                </div>
              </div>
              {editingId && (
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <Label className="text-sm font-normal">Active</Label>
                  <Switch
                    checked={form.active}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))}
                  />
                </div>
              )}
              <Button className="w-full" disabled={saving} onClick={submitForm}>
                <Megaphone className="h-4 w-4" /> {editingId ? "Save changes" : "Create campaign"}
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={startCreate}>
              <Plus className="h-4 w-4" /> New campaign
            </Button>
          )}

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by code…"
                className="search-input h-8 border-input bg-background pl-8 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:bg-input/30"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v as StatusFilter)}>
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
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)
            ) : all.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No campaigns yet.</p>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No campaigns match this search/filter.</p>
            ) : (
              filtered.map((c) => (
                <div key={c.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
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
                  </div>
                  <div className="flex items-center gap-1.5 text-lg font-bold">
                    <Percent className="h-4 w-4 text-primary" /> {c.discountPercent}%
                    <span className="text-xs font-normal text-muted-foreground">
                      off · {c.startDate.slice(0, 10)} → {c.endDate.slice(0, 10)}
                    </span>
                  </div>
                  {c.usageLimit > 0 && (
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>{c.usageCount.toLocaleString()} / {c.usageLimit.toLocaleString()} seats used</span>
                        <span>{Math.round((c.usageCount / c.usageLimit) * 100)}%</span>
                      </div>
                      <Meter value={(c.usageCount / c.usageLimit) * 100} height={6} />
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 pt-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => startEdit(c)}>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
