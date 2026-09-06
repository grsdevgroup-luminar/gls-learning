"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export function BulkAssignConfirmDialog({
  open,
  onOpenChange,
  orgName,
  label,
  count,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
  /** e.g. "all public courses" / `all courses in "Cloud"` */
  label: string;
  count: number;
  pending: boolean;
  onConfirm: () => void;
}) {
  const courseWord = count === 1 ? "course" : "courses";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign {label}?</DialogTitle>
          <DialogDescription>
            This assigns {count} {courseWord} to {orgName} at once. Each can still be removed individually afterward.
          </DialogDescription>
        </DialogHeader>
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
