"use client";

import { useState } from "react";
import type { CreateOrganizationResultDto } from "@skillstream/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, CheckCircle2, AlertTriangle, Check } from "lucide-react";

export function CredentialsPanel({
  result,
  onClose,
}: {
  result: CreateOrganizationResultDto | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(result!.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied — the password is still visible to copy by hand.
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{result.name} is ready</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Admin email</p>
            <p className="mt-0.5 text-sm font-medium">{result.adminEmail}</p>
            <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Temporary password</p>
            <div className="mt-0.5 flex items-center gap-2">
              <code className="flex-1 rounded bg-background px-2 py-1 text-sm font-semibold">
                {result.tempPassword}
              </code>
              <Button type="button" variant="outline" size="icon-sm" onClick={() => void copyPassword()}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {result.credentialsEmailSent ? (
            <div className="flex items-start gap-2 text-sm text-success">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Credentials emailed to {result.adminEmail}.</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>We couldn&apos;t email these credentials — copy them and share manually.</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            This password won&apos;t be shown again. The admin will be asked to set their own password on first login.
          </p>

          <Button className="w-full" onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
