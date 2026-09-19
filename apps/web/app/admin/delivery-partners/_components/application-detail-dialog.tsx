"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Check, X, Mail, Globe2, Calendar, FileText, Download, Percent } from "lucide-react";
import { initials } from "@/lib/format";
import { flagFor, nameFor } from "@skillstream/shared";
import type { DeliveryPartnerApplicationDto } from "@/lib/api/endpoints";
import { shortDate, statusBadge } from "./application-status";

export function ApplicationDetailDialog({
  app: a,
  onClose,
  onOpenApprove,
  onOpenReject,
}: {
  app: DeliveryPartnerApplicationDto | null;
  onClose: () => void;
  onOpenApprove: (app: DeliveryPartnerApplicationDto) => void;
  onOpenReject: (app: DeliveryPartnerApplicationDto) => void;
}) {
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
                <p className="text-sm text-muted-foreground">{a.email}</p>
              </div>
            </div>

            <div
              className={`mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm ${a.reviewedAt ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
            >
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="flex items-start gap-1.5">
                  <Mail className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="break-words">{a.email}</span>
                </div>
              </div>
              {a.country && (
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Country</div>
                  <div className="inline-flex items-center gap-1.5">
                    <Globe2 className="size-3.5 shrink-0 text-muted-foreground" /> {flagFor(a.country)} {nameFor(a.country)}
                  </div>
                </div>
              )}
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
              {a.expectedCommissionPercent != null && (
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Requested commission</div>
                  <div className="inline-flex items-center gap-1.5"><Percent className="size-3.5 shrink-0 text-muted-foreground" /> {a.expectedCommissionPercent}%</div>
                </div>
              )}
            </div>

            {a.customFields.length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-muted-foreground">Additional details</div>
                <dl className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                  {a.customFields.map((f, i) => (
                    <div key={i} className="min-w-0 rounded-lg border border-border p-2.5 text-sm">
                      <dt className="text-xs text-muted-foreground">{f.label}</dt>
                      <dd className="break-words">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {a.documents.length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-muted-foreground">Documents</div>
                <div className="mt-1.5 space-y-1.5">
                  {a.documents.map((d) => (
                    <a
                      key={d.key}
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm hover:bg-muted"
                    >
                      <FileText className="size-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate">{d.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{d.sizeLabel}</span>
                      <Download className="size-3.5 shrink-0 text-muted-foreground" />
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
                <Button onClick={() => onOpenApprove(a)}>
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
