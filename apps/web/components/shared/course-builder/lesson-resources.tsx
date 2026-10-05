"use client";

import { useRef, useState } from "react";
import type { LessonResourceDto } from "@skillstream/shared";
import { authoringApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { formatBytes } from "@/lib/format";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Upload, Trash2, Link2, ExternalLink, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

// Kept in sync with apps/api/src/modules/storage/storage.constants.ts. Client
// pre-check is a UX nicety — the API enforces the same list on upload.
const RESOURCE_ACCEPT_EXTENSIONS = [
  ".pdf",
  ".zip",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".txt",
  ".csv",
  ".mp3",
] as const;
const RESOURCE_MAX_BYTES = 10 * 1024 * 1024;
const RESOURCE_LIMIT = 20;

/**
 * Lesson attachments. Two modes on the same list:
 *  - Link: instructor pastes a URL they own (no `storageKey`).
 *  - Upload: platform hosts the file (has `storageKey`) — read-only once
 *    uploaded, remove calls the server so we don't leak the bucket object.
 * Uploads require a saved lesson (needs a lessonId to POST to).
 */
export function LessonResources({
  lessonId,
  isNew,
  resources,
  onChange,
  pendingFiles,
  onPendingUpload,
  onRemovePendingUpload,
}: {
  lessonId: string;
  isNew: boolean;
  resources: LessonResourceDto[];
  onChange: (next: LessonResourceDto[]) => void;
  pendingFiles: File[];
  onPendingUpload: (file: File) => void;
  onRemovePendingUpload: (index: number) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const patch = (i: number, fields: Partial<LessonResourceDto>) =>
    onChange(
      resources?.map((r, x) => (x === i ? { ...r, ...fields } : r)) ?? [],
    );

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    if (resources.length >= RESOURCE_LIMIT) {
      toast.error(`Max ${RESOURCE_LIMIT} resources per lesson.`);
      return;
    }
    if (file.size > RESOURCE_MAX_BYTES) {
      toast.error(`File exceeds 10 MB (${formatBytes(file.size)}).`);
      return;
    }
    const ext = ("." + (file.name.split(".").pop() ?? "")).toLowerCase();
    if (
      !RESOURCE_ACCEPT_EXTENSIONS.includes(
        ext as (typeof RESOURCE_ACCEPT_EXTENSIONS)[number],
      )
    ) {
      toast.error(`Unsupported file type: ${ext || "unknown"}`);
      return;
    }
    if (isNew) {
      onPendingUpload(file);
      toast.success(
        `${file.name} queued — save the lesson to finish uploading.`,
      );
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const uploaded = await authoringApi.uploadLessonResource(lessonId, file);
      onChange([...resources, uploaded]);
      toast.success(`Uploaded ${uploaded.name}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleRemove(i: number) {
    const r = resources[i];
    if (r.storageKey) {
      try {
        await authoringApi.deleteLessonResource(lessonId, r.storageKey);
      } catch (err) {
        toast.error(getApiErrorMessage(err));
        return;
      }
    }
    onChange(resources?.filter((_, x) => x !== i) ?? []);
  }

  const canUpload =
    !uploading && resources.length + pendingFiles.length < RESOURCE_LIMIT;

  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <FileText className="h-3.5 w-3.5" /> Downloadable resources
        <span className="ml-auto text-[11px] font-normal">
          {resources.length}/{RESOURCE_LIMIT}
        </span>
      </div>

      {pendingFiles.map((file, i) => (
        <div
          key={`pending-${file.name}-${file.lastModified}`}
          className="flex items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-xs text-muted-foreground"
        >
          <Upload className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{file.name}</span>
          <span className="ml-auto shrink-0">Pending save</span>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Remove pending resource"
            onClick={() => onRemovePendingUpload(i)}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      ))}

      {resources?.map((r, i) =>
        r.storageKey ? (
          // Uploaded file — filename + size are frozen at upload time.
          <div
            key={i}
            className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5"
          >
            <Upload className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate text-sm hover:underline"
              title={r.name}
            >
              {r.name}
            </a>
            {r.sizeLabel && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {r.sizeLabel}
              </span>
            )}
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Open resource"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <ConfirmDialog
              trigger={
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Remove resource"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              }
              title="Remove this resource?"
              description="Students will no longer be able to download it."
              confirmLabel="Remove"
              onConfirm={() => handleRemove(i)}
            />
          </div>
        ) : (
          <div key={i} className="flex items-start gap-2 sm:items-center">
            <Link2 className="mt-2 h-3.5 w-3.5 shrink-0 text-muted-foreground sm:mt-0" />
            <div className="min-w-0 flex-1 space-y-2 sm:flex sm:items-center sm:gap-2 sm:space-y-0">
            <Input
              value={r.name}
              onChange={(e) => patch(i, { name: e.target.value })}
              placeholder="Name (e.g. Starter files)"
              className="h-8 flex-1 min-w-0"
            />
            <Input
              value={r.url}
              onChange={(e) => patch(i, { url: e.target.value })}
              placeholder="https://…"
              type="url"
              className="h-8 min-w-0 flex-[2]"
            />
            </div>
            <ConfirmDialog
              trigger={
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Remove resource"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              }
              title="Remove this resource?"
              description="Students will no longer be able to download it."
              confirmLabel="Remove"
              onConfirm={() => handleRemove(i)}
            />
          </div>
        ),
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept={RESOURCE_ACCEPT_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => handleUpload(e.target.files?.[0])}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7"
          onClick={() => fileInput.current?.click()}
          disabled={!canUpload}
          title={
            isNew ? "The file will upload when the lesson is saved" : undefined
          }
        >
          {uploading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="mr-1.5 h-3.5 w-3.5" />
          )}
          Upload file
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-muted-foreground"
          onClick={() => onChange([...resources, { name: "", url: "" }])}
          disabled={resources.length + pendingFiles.length >= RESOURCE_LIMIT}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add link
        </Button>
        {isNew && (
          <span className="text-[11px] text-muted-foreground">
            Files are uploaded when you save the lesson.
          </span>
        )}
      </div>
    </div>
  );
}
