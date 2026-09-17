"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { PartnerDocumentDto } from "@skillstream/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

const ACCEPT = ".pdf,.doc,.docx,.png,.jpg,.jpeg";
const MAX_BYTES = 5 * 1024 * 1024;

/** Title + file picker feeding the delivery-partner application's document
 *  list. Uploads immediately on add (the caller is always authenticated with
 *  a pending application to attach to by the time this renders). */
export function PartnerDocumentUploader({
  documents,
  onChange,
  max = 5,
}: {
  documents: PartnerDocumentDto[];
  onChange: (next: PartnerDocumentDto[]) => void;
  max?: number;
}) {
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFilePicked(file: File | undefined) {
    if (!file) return;
    if (!title.trim()) {
      toast.error("Give the document a title first");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`File must be under ${Math.floor(MAX_BYTES / (1024 * 1024))} MB`);
      return;
    }
    setUploading(true);
    try {
      const doc = await api.uploadPartnerDocument(title.trim(), file);
      onChange([...documents, doc]);
      setTitle("");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemove(key: string) {
    onChange(documents.filter((d) => d.key !== key));
    try {
      await api.deletePartnerDocument(key);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-3">
      {documents.map((d) => (
        <div
          key={d.key}
          className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm"
        >
          <FileText className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{d.title}</div>
            <div className="truncate text-xs text-muted-foreground">{d.name} · {d.sizeLabel}</div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="Remove document"
            onClick={() => handleRemove(d.key)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {documents.length < max && (
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
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      )}
    </div>
  );
}
