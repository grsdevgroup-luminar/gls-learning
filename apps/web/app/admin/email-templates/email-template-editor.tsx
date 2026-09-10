"use client";

import { useEffect, useRef, useState } from "react";
import type { EmailTemplateDto } from "@skillstream/shared";
import {
  useResetEmailTemplate,
  usePreviewEmailTemplate,
  useSendTestEmail,
  useUpdateEmailTemplate,
} from "@/lib/api/hooks";
import { getApiErrorMessage } from "@/lib/api/errors";
import { relativeDate } from "@/lib/format";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Monitor, Smartphone, Send, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type Field = "subject" | "body" | "ctaLabel";

/** Inserts `snippet` at the current cursor position of whichever field was
 *  last focused — clicking a variable chip acts like typing it. */
function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  set: (v: string) => void,
  snippet: string,
) {
  if (!el) {
    set(value + snippet);
    return;
  }
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const next = value.slice(0, start) + snippet + value.slice(end);
  set(next);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + snippet.length, start + snippet.length);
  });
}

function unknownPlaceholders(text: string, allowed: Set<string>): string[] {
  const found = [...text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(found)].filter((t) => !allowed.has(t));
}

export function EmailTemplateEditor({
  template,
  onClose,
}: {
  template: EmailTemplateDto;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [ctaLabel, setCtaLabel] = useState(template.ctaLabel ?? "");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const update = useUpdateEmailTemplate();
  const reset = useResetEmailTemplate();
  const previewMutation = usePreviewEmailTemplate();
  const sendTest = useSendTestEmail();

  const dirty =
    subject !== template.subject ||
    body !== template.body ||
    ctaLabel !== (template.ctaLabel ?? "");

  const allowedVars = new Set(template.variables.map((v) => v.name));
  const badTags = [...unknownPlaceholders(subject, allowedVars), ...unknownPlaceholders(body, allowedVars)];

  // Live preview, debounced — re-renders from the draft, not the saved copy.
  useEffect(() => {
    if (badTags.length > 0) return;
    const timer = setTimeout(() => {
      previewMutation.mutate(
        { key: template.key, subject, body, ctaLabel: ctaLabel || undefined },
        { onSuccess: setPreview },
      );
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, body, ctaLabel]);

  function requestClose() {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  function save() {
    if (badTags.length > 0) return;
    update.mutate(
      { key: template.key, subject, body, ctaLabel: ctaLabel || undefined },
      {
        onSuccess: () => {
          toast.success(`${template.label} updated`);
          onClose();
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && requestClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" showCloseButton>
        <DialogHeader>
          <DialogTitle>Edit template — {template.label}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {template.description}
            {template.isCustomized && template.updatedAt && (
              <> · Last edited {relativeDate(template.updatedAt)}
                {template.updatedByName ? ` by ${template.updatedByName}` : ""}</>
            )}
          </p>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="flex gap-2">
            <span className="w-14 shrink-0 text-muted-foreground">From</span>
            <span className="text-muted-foreground">SkillStream &lt;noreply@skillstream.dev&gt; (fixed)</span>
          </div>
          <div className="flex gap-2">
            <span className="w-14 shrink-0 text-muted-foreground">To</span>
            <span className="text-muted-foreground">the recipient's email</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                ref={subjectRef}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <VariableChips
                variables={template.variables}
                onInsert={(snippet) =>
                  insertAtCursor(subjectRef.current, subject, setSubject, snippet)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
              />
              <VariableChips
                variables={template.variables}
                onInsert={(snippet) => insertAtCursor(bodyRef.current, body, setBody, snippet)}
              />
            </div>

            {template.ctaLabel !== undefined && (
              <div className="space-y-1.5">
                <Label>Button label</Label>
                <Input
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder={template.ctaLabel}
                />
              </div>
            )}

            {badTags.length > 0 && (
              <p className="text-xs text-destructive">
                Unknown placeholder{badTags.length > 1 ? "s" : ""}:{" "}
                {badTags.map((t) => `{{${t}}}`).join(", ")} — not available for this email.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Preview</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="icon-sm"
                  variant={device === "desktop" ? "secondary" : "outline"}
                  onClick={() => setDevice("desktop")}
                >
                  <Monitor className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant={device === "mobile" ? "secondary" : "outline"}
                  onClick={() => setDevice("mobile")}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <div
                className="mx-auto overflow-hidden rounded-md border bg-white"
                style={{ width: device === "mobile" ? 375 : "100%" }}
              >
                {preview ? (
                  <iframe
                    title="Email preview"
                    srcDoc={preview.html}
                    className="h-[420px] w-full"
                    sandbox=""
                  />
                ) : (
                  <div className="grid h-[420px] place-items-center text-xs text-muted-foreground">
                    {badTags.length > 0 ? "Fix the placeholder above to preview" : "Rendering…"}
                  </div>
                )}
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Rendered live from your draft, with sample data
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <div>
            {template.isCustomized && (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setConfirmReset(true)}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset to default
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={sendTest.isPending || badTags.length > 0}
              onClick={() =>
                sendTest.mutate(template.key, {
                  onSuccess: () => toast.success("Test email sent to your inbox"),
                  onError: (e) => toast.error(getApiErrorMessage(e)),
                })
              }
            >
              <Send className="h-3.5 w-3.5" /> Send test email to myself
            </Button>
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={update.isPending || badTags.length > 0}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>

        <ConfirmDialog
          open={confirmReset}
          onOpenChange={setConfirmReset}
          title={`Reset "${template.label}" to default?`}
          description="This discards the customized subject and body. This can't be undone."
          confirmLabel="Reset"
          pending={reset.isPending}
          onConfirm={async () => {
            try {
              await reset.mutateAsync(template.key);
              toast.success(`${template.label} reset to default`);
              onClose();
            } catch (e) {
              toast.error(getApiErrorMessage(e));
            }
          }}
        />
        <ConfirmDialog
          open={confirmDiscard}
          onOpenChange={setConfirmDiscard}
          title="Discard unsaved changes?"
          description="Your edits to this template haven't been saved."
          confirmLabel="Discard"
          onConfirm={() => onClose()}
        />
      </DialogContent>
    </Dialog>
  );
}

function VariableChips({
  variables,
  onInsert,
}: {
  variables: EmailTemplateDto["variables"];
  onInsert: (snippet: string) => void;
}) {
  if (variables.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {variables.map((v) => (
        <Tooltip key={v.name}>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => onInsert(`{{${v.name}}}`)}
                className="rounded-full border border-dashed border-input px-2 py-0.5 text-xs font-mono text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              />
            }
          >
            {`{{${v.name}}}`}
          </TooltipTrigger>
          <TooltipContent>
            {v.description} — e.g. "{v.sample}"
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
