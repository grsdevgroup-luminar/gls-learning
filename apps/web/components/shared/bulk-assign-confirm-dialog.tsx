"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export function BulkAssignConfirmDialog({
  open,
  onOpenChange,
  targetName,
  label,
  count,
  pending,
  onConfirm,
  memberCap,
  onMemberCapChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The org or delivery-partner name this batch is being assigned to. */
  targetName: string;
  /** e.g. "all public courses" / `all courses in "Cloud"` */
  label: string;
  count: number;
  pending: boolean;
  onConfirm: () => void;
  /** Delivery-partner bulk assign only — each course in the batch gets this
   *  same member cap (per-course cap, see DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md
   *  §3). Omit entirely for org bulk assign, which has no cap concept. */
  memberCap?: number;
  onMemberCapChange?: (value: number) => void;
}) {
  const courseWord = count === 1 ? "course" : "courses";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign {label}?</DialogTitle>
          <DialogDescription>
            This assigns {count} {courseWord} to {targetName} at once. Each can still be removed individually afterward.
          </DialogDescription>
        </DialogHeader>
        {memberCap !== undefined && (
          <div className="space-y-1.5">
            <Label htmlFor="bulk-member-cap">Member cap per course</Label>
            <Input
              id="bulk-member-cap"
              type="number"
              min={0}
              max={1000}
              placeholder="0 = unlimited"
              value={memberCap}
              onChange={(e) => onMemberCapChange?.(Number(e.target.value))}
              className="w-28"
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? "Assigning…" : `Assign ${count} ${courseWord}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
