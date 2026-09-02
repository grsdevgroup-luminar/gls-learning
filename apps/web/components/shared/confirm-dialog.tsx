"use client";

import { useState, type ReactNode } from "react";
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

interface ConfirmDialogProps {
  // Either an uncontrolled trigger element (wrapped to open the dialog itself)
  // or a controlled open/onOpenChange pair — the latter is for callers that
  // can't nest a DialogTrigger in the clicked element, e.g. a dropdown menu
  // item, which unmounts before a trigger-owned dialog would get to open.
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  title,
  description,
  confirmLabel = "Delete",
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [openState, setOpenState] = useState(false);
  const open = trigger ? openState : (openProp ?? false);
  const setOpen = trigger ? setOpenState : (onOpenChangeProp ?? (() => {}));

  async function confirm() {
    await onConfirm();
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
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button variant="destructive" onClick={() => void confirm()} disabled={pending}>
            {pending ? "Deleting..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
