"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ReasonConfirmDialogProps {
  // Same dual controlled/trigger API as ConfirmDialog — see its comment.
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
}

/** Like ConfirmDialog, but for destructive actions that must carry a reason
 *  the affected person can see — course deletion, org member removal. The
 *  reason is required: "Delete"/"Remove" stays disabled until non-empty. */
export function ReasonConfirmDialog({
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  title,
  description,
  reasonLabel = "Reason",
  reasonPlaceholder = "Explain why — this is shared with the person affected.",
  confirmLabel = "Delete",
  pending = false,
  onConfirm,
}: ReasonConfirmDialogProps) {
  const [openState, setOpenState] = useState(false);
  const open = trigger ? openState : (openProp ?? false);
  const setOpen = trigger ? setOpenState : (onOpenChangeProp ?? (() => {}));
  const [reason, setReason] = useState("");

  // Clear the draft reason once the dialog closes, so it doesn't carry over
  // to the next member/course this same dialog instance gets reused for.
  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  async function confirm() {
    if (!reason.trim()) return;
    await onConfirm(reason.trim());
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && (
        <DialogTrigger render={trigger as React.ReactElement}>{trigger}</DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reason-confirm-dialog-reason">{reasonLabel}</Label>
          <Textarea
            id="reason-confirm-dialog-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
            disabled={pending}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => void confirm()}
            disabled={pending || !reason.trim()}
          >
            {pending ? "Working..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
