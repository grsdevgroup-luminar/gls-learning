"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Check, X, ExternalLink, Mail, Calendar, FileText, Download } from "lucide-react";
import { initials } from "@/lib/format";
import type { InstructorApplicationDto } from "@/lib/api/endpoints";
import { shortDate, statusBadge } from "./application-status";

export function ApplicationDetailDialog({
  app: a,
  onClose,
  onApprove,
  approving,
  onOpenReject,
}: {
  app: InstructorApplicationDto | null;
  onClose: () => void;
  onApprove: (app: InstructorApplicationDto) => void;
  approving: boolean;
  onOpenReject: (app: InstructorApplicationDto) => void;
}) {
  const links = a
    ? [
        { url: a.sampleUrl, label: "Sample / portfolio" },
        { url: a.linkedinUrl, label: "LinkedIn" },
        { url: a.twitterUrl, label: "Twitter / X" },
        { url: a.youtubeUrl, label: "YouTube" },
        { url: a.facebookUrl, label: "Facebook" },
        { url: a.otherUrl, label: "Other link" },
      ].filter((l) => l.url)
    : [];

  return (
    <Dialog open={!!a} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl sm:max-w-2xl">
        {a && (
          <>
            <DialogHeader>
              <DialogTitle className="sr-only">Application — {a.name}</DialogTitle>
            </DialogHeader>
            <div className="flex items-start gap-3">
              <Avatar className="size-12 ring-1 ring-border">
                <AvatarFallback className="brand-gradient text-sm text-white">{initials(a.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold">{a.name}</span>
                  {statusBadge[a.status]}
                </div>
                <p className="text-sm text-muted-foreground">{a.headline}</p>
              </div>
            </div>

            <div
              className={cn(
                "mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm",
                // Reserving a 4th column when there's no Reviewed date to fill it
                // starves Email of width it doesn't need to give up — only go to
                // 4 columns once something actually occupies the 4th slot.
                a.reviewedAt ? "sm:grid-cols-4" : "sm:grid-cols-3",
              )}
            >
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="flex items-start gap-1.5">
                  <Mail className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="break-words">{a.email}</span>
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Expertise</div>
                <div className="break-words">{a.expertise}</div>
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Applied</div>
                <div className="inline-flex items-center gap-1.5"><Calendar className="size-3.5 shrink-0 text-muted-foreground" /> {shortDate(a.appliedAt)}</div>
              </div>
              {a.reviewedAt && (
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Reviewed</div>
                  <div className="inline-flex items-center gap-1.5"><Calendar className="size-3.5 shrink-0 text-muted-foreground" /> {shortDate(a.reviewedAt)}</div>
                </div>
              )}
            </div>

            <div className="mt-4">
              <div className="text-xs text-muted-foreground">About</div>
              <p className="mt-1 text-sm leading-relaxed">{a.bio}</p>
            </div>

            {a.cvUrl && (
              <div className="mt-4">
                <div className="text-xs text-muted-foreground">Résumé / CV</div>
                <a
                  href={a.cvUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm hover:bg-muted"
                >
                  <FileText className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate">{a.cvName ?? "CV"}</span>
                  {a.cvSizeLabel && <span className="shrink-0 text-xs text-muted-foreground">{a.cvSizeLabel}</span>}
                  <Download className="size-3.5 shrink-0 text-muted-foreground" />
                </a>
              </div>
            )}

            {links.length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-muted-foreground">Links</div>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {links.map((l) => (
                    <a
                      key={l.label}
                      href={l.url!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="size-3" /> {l.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {a.note && (
              <div className="mt-4">
                <div className="text-xs text-muted-foreground">Review note</div>
                <p className="mt-1 text-sm leading-relaxed">{a.note}</p>
              </div>
            )}

            {a.status === "PENDING" && (
              <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
                <Button variant="outline" className="text-destructive" onClick={() => onOpenReject(a)}>
                  <X /> Reject
                </Button>
                <Button onClick={() => onApprove(a)} disabled={approving}>
                  <Check /> Approve
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
