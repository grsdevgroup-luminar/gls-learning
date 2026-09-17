"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

export interface StagedDocument {
  id: string;
  title: string;
  file: File;
}

const ACCEPT = ".pdf,.doc,.docx,.png,.jpg,.jpeg";
const MAX_BYTES = 5 * 1024 * 1024;

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
}

/** Title + file rows held locally (nothing is uploaded yet) — the parent
 *  form uploads each one after the account/application it belongs to
 *  actually exists, so the whole thing submits as a single user action. */
export function StagedDocumentPicker({
  items,
  onChange,
  max = 5,
}: {
  items: StagedDocument[];
  onChange: (next: StagedDocument[]) => void;
  max?: number;
}) {
  const [title, setTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFilePicked(file: File | undefined) {
    if (!file) return;
    if (!title.trim()) {
      toast.error("Give the document a title first");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`File must be under ${Math.floor(MAX_BYTES / (1024 * 1024))} MB`);
      return;
    }
    onChange([...items, { id: crypto.randomUUID(), title: title.trim(), file }]);
    setTitle("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function remove(id: string) {
    onChange(items.filter((d) => d.id !== id));
  }

  return (
    <div className="space-y-3">
      {items.map((d) => (
        <div
          key={d.id}
          className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm"
        >
          <FileText className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{d.title}</div>
            <div className="truncate text-xs text-muted-foreground">{d.file.name} · {humanSize(d.file.size)}</div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="Remove document"
            onClick={() => remove(d.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {items.length < max && (
        <div className="flex gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title, e.g. Business registration"
            maxLength={80}
            className="flex-1"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => handleFilePicked(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> Add
          </Button>
        </div>
      )}
    </div>
  );
}
