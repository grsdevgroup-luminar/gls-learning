"use client";

import { useRef } from "react";
import type { CourseResourceDto } from "@grslearning/shared";
import { FileText, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ACCEPTED = ".pdf,.zip,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.mp3";

export function CourseResources({
  resources,
  pendingFiles,
  onAddFiles,
  onRemoveResource,
  onRemovePending,
}: {
  resources: CourseResourceDto[];
  pendingFiles: File[];
  onAddFiles: (files: File[]) => void;
  onRemoveResource: (id: string) => void;
  onRemovePending: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Card className="min-w-0 max-w-full">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Course resources (optional)</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Available to enrolled students separately from lesson progress.
          </p>
        </div>
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
          <Upload className="h-4 w-4" /> Add files
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED}
            className="sr-only"
            onChange={(event) => {
              onAddFiles(Array.from(event.target.files ?? []));
              event.currentTarget.value = "";
            }}
          />
        </label>
      </CardHeader>
      <CardContent className="space-y-2">
        {resources.map((resource) => (
          <div key={resource.id} className="flex min-w-0 items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate" title={resource.name}>{resource.name}</span>
            {resource.sizeLabel && <span className="shrink-0 text-xs text-muted-foreground">{resource.sizeLabel}</span>}
            <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove ${resource.name}`} onClick={() => onRemoveResource(resource.id)}>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
        {pendingFiles.map((file, index) => (
          <div key={`${file.name}-${file.lastModified}-${index}`} className="flex min-w-0 items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
            <Upload className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate" title={file.name}>{file.name}</span>
            <span className="shrink-0 text-xs">Pending upload</span>
            <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove pending ${file.name}`} onClick={() => onRemovePending(index)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {resources.length === 0 && pendingFiles.length === 0 && (
          <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-3 py-6 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            <Plus className="h-4 w-4" /> Add optional course resources
          </button>
        )}
        <p className="text-xs text-muted-foreground">Files are uploaded when you save the course. They do not count as lessons or affect sequential access.</p>
      </CardContent>
    </Card>
  );
}
