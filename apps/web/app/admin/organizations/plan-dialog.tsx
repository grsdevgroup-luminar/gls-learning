"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orgApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { OrganizationDto } from "@skillstream/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";

type SuspensionMode = NonNullable<OrganizationDto["suspensionMode"]>;

/** Seats and status are platform-admin only (the API refuses them from an org
 *  admin), so this is the one place they can be changed. Choosing SUSPENDED
 *  also asks how access should lock — immediately, or after a grace period —
 *  matching the flexibility the business wants for a suspended customer. */
export function PlanDialog({ org }: { org: OrganizationDto }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [seatCount, setSeatCount] = useState(String(org.seatCount));
  const [status, setStatus] = useState(org.status);
  const [suspensionMode, setSuspensionMode] = useState<SuspensionMode>(
    org.suspensionMode ?? "LOCK_NOW",
  );
  const [graceDays, setGraceDays] = useState("14");

  const save = useMutation({
    mutationFn: () =>
      orgApi.update(org.id, {
        seatCount: Math.max(1, parseInt(seatCount) || org.seatCount),
        status,
        ...(status === "SUSPENDED"
          ? {
              suspensionMode,
              ...(suspensionMode === "GRACE_PERIOD"
                ? { graceDays: Math.max(1, parseInt(graceDays) || 14) }
                : {}),
            }
          : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-organizations"] });
      toast.success(`${org.name} updated`);
      setOpen(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" />}>
        <Settings2 className="h-3 w-3" /> Plan
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{org.name} — seats &amp; status</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Seats</Label>
            <Input
              type="number"
              min={org.usedSeats || 1}
              value={seatCount}
              onChange={(e) => setSeatCount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{org.usedSeats} currently in use.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v as OrganizationDto["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {["TRIAL", "ACTIVE", "SUSPENDED"].map((s) => (
                  <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {status === "SUSPENDED" && (
            <div className="space-y-2 rounded-lg border border-dashed p-3">
              <Label className="text-xs">When access locks</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={suspensionMode === "LOCK_NOW" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setSuspensionMode("LOCK_NOW")}
                >
                  Lock immediately
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={suspensionMode === "GRACE_PERIOD" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setSuspensionMode("GRACE_PERIOD")}
                >
                  Grace period
                </Button>
              </div>
              {suspensionMode === "LOCK_NOW" ? (
                <p className="text-xs text-muted-foreground">
                  Members and the org admin lose access to courses and the portal right away. Certificates already earned stay valid.
                </p>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs">Days before access locks</Label>
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={graceDays}
                    onChange={(e) => setGraceDays(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Existing access continues until then; new enrollments are blocked right away. Certificates already earned stay valid.
                  </p>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
