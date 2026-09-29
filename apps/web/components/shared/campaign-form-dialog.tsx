"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { DeliveryPartnerCampaignDto, DeliveryPartnerCampaignScope } from "@skillstream/shared";
import { adminApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { CourseMultiSelect } from "@/components/shared/course-multi-select";
import { UnlimitedNumberInput } from "@/components/shared/unlimited-number-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";

const todayIso = () => new Date().toISOString().slice(0, 10);

type FormState = {
  discountPercent: string;
  usageLimit: string;
  startDate: string;
  endDate: string;
  active: boolean;
  scope: DeliveryPartnerCampaignScope;
  courseIds: string[];
};

function emptyForm(): FormState {
  return {
    discountPercent: "20",
    usageLimit: "0",
    startDate: todayIso(),
    endDate: "",
    active: true,
    scope: "GLOBAL",
    courseIds: [],
  };
}

function formFromCampaign(c: DeliveryPartnerCampaignDto): FormState {
  return {
    discountPercent: String(c.discountPercent),
    usageLimit: String(c.usageLimit),
    startDate: c.startDate.slice(0, 10),
    endDate: c.endDate.slice(0, 10),
    active: c.active,
    scope: c.scope,
    courseIds: c.courseIds,
  };
}

/**
 * Single-purpose create/edit dialog for exactly one campaign — no browsing,
 * no split panes. Opened from PartnerCampaignsListDialog's "New Campaign"
 * button (create mode, no `campaign` prop) or a row's "Edit" button (edit
 * mode, pre-filled from `campaign`).
 */
export function CampaignFormDialog({
  open,
  onOpenChange,
  partnerId,
  partnerName,
  campaign,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: string;
  partnerName: string;
  campaign?: DeliveryPartnerCampaignDto;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => campaign ? formFromCampaign(campaign) : emptyForm());
  const [seatLimitValid, setSeatLimitValid] = useState(true);

  useEffect(() => {
    if (open) setForm(campaign ? formFromCampaign(campaign) : emptyForm());
  }, [open, campaign]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "delivery-partners", partnerId, "campaigns"] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      adminApi.createPartnerCampaign(partnerId, {
        discountPercent: Number(form.discountPercent),
        startDate: new Date(form.startDate),
        endDate: new Date(form.endDate),
        usageLimit: Number(form.usageLimit),
        scope: form.scope,
        courseIds: form.scope === "SPECIFIC" ? form.courseIds : undefined,
      }),
    onSuccess: (c) => {
      toast.success(`Campaign created — code ${c.code}`);
      invalidate();
      onOpenChange(false);
      onSaved?.();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!campaign) throw new Error("No campaign to update");
      return adminApi.updatePartnerCampaign(partnerId, campaign.id, {
        discountPercent: Number(form.discountPercent),
        startDate: new Date(form.startDate),
        endDate: new Date(form.endDate),
        usageLimit: Number(form.usageLimit),
        active: form.active,
        scope: form.scope,
        courseIds: form.scope === "SPECIFIC" ? form.courseIds : undefined,
      });
    },
    onSuccess: () => {
      toast.success("Campaign updated");
      invalidate();
      onOpenChange(false);
      onSaved?.();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const saving = createMutation.isPending || updateMutation.isPending;

  function submit() {
    const pct = Number(form.discountPercent);
    if (!pct || pct <= 0 || pct > 100) return toast.error("Discount must be between 1 and 100");
    if (!seatLimitValid) return toast.error("Seat limit must be greater than 0");
    if (!form.endDate) return toast.error("Pick an end date");
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      return toast.error("End date must be after the start date");
    }
    if (form.scope === "SPECIFIC" && form.courseIds.length === 0) {
      return toast.error("Select at least one course for a course-specific campaign");
    }
    if (campaign) updateMutation.mutate();
    else createMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] !max-w-none sm:w-[min(640px,calc(100vw-3rem))] sm:min-w-[560px] lg:w-[min(760px,calc(100vw-4rem))]">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit campaign" : "New campaign"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Discount %</Label>
              <Input
                value={form.discountPercent}
                onChange={(e) => setForm((p) => ({ ...p, discountPercent: e.target.value }))}
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Seat limit</Label>
              <UnlimitedNumberInput
                key={campaign?.id ?? "new"}
                value={form.usageLimit}
                onChange={(v) => setForm((p) => ({ ...p, usageLimit: v }))}
                onValidityChange={setSeatLimitValid}
                max={1_000_000}
                aria-label="Seat limit"
              />
            </div>
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

          <div className="flex items-center gap-4">
            <Label className="shrink-0">Applies to</Label>
            <div className="inline-flex flex-1 rounded-md border border-border p-0.5 text-sm">
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, scope: "GLOBAL" }))}
                className={`flex-1 rounded px-2.5 py-1.5 font-medium transition-colors ${
                  form.scope === "GLOBAL" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All courses
              </button>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, scope: "SPECIFIC" }))}
                className={`flex-1 rounded px-2.5 py-1.5 font-medium transition-colors ${
                  form.scope === "SPECIFIC" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Specific courses
              </button>
            </div>
            {campaign && (
              <label className="flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5">
                <span className="text-sm">Active</span>
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))}
                />
              </label>
            )}
          </div>

          {form.scope === "SPECIFIC" && (
            <CourseMultiSelect
              selectedIds={form.courseIds}
              onChange={(ids) => setForm((p) => ({ ...p, courseIds: ids }))}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={saving} onClick={submit}>
            <Megaphone className="h-4 w-4" />
            {campaign ? "Save changes" : `Create campaign for ${partnerName}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
