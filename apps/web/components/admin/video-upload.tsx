"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/shared/meter";
import {
  UploadCloud, Film, CheckCircle2, ShieldCheck, RefreshCw, X, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authoringApi } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { toast } from "sonner";

type Phase = "idle" | "uploading" | "ready" | "error";

const MAX_BYTES = 5 * 1024 * 1024 * 1024; // Cloudflare direct_upload cap

export function VideoUpload({
  compact = false,
  initiallyUploaded = false,
  onReady,
}: {
  compact?: boolean;
  initiallyUploaded?: boolean;
  onReady?: (uid: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>(initiallyUploaded ? "ready" : "idle");
  const [progress, setProgress] = useState(initiallyUploaded ? 100 : 0);
  const [name, setName] = useState(initiallyUploaded ? "Uploaded video" : "");
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  async function upload(file: File) {
    if (!file.type.startsWith("video/")) {
      toast.error("Please choose a video file");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Video is larger than 5 GB");
      return;
    }
    setName(file.name);
    setError("");
    setPhase("uploading");
    setProgress(0);
    try {
      const { uploadUrl, uid } = await authoringApi.mediaUploadUrl();
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        const form = new FormData();
        form.append("file", file);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress((e.loaded / e.total) * 100);
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Upload failed (${xhr.status})`));
        xhr.onerror = () => reject(new Error("Upload failed — check your connection"));
        xhr.onabort = () => reject(new Error("Upload cancelled"));
        xhr.open("POST", uploadUrl);
        xhr.send(form);
      });
      setPhase("ready");
      onReady?.(uid);
    } catch (e) {
      setError(getApiErrorMessage(e));
      setPhase("error");
    }
  }

  function reset() {
    xhrRef.current?.abort();
    setPhase("idle");
    setProgress(0);
    setName("");
    setError("");
  }

  if (phase === "ready") {
    return (
      <div className={cn("flex items-center gap-3 rounded-lg border bg-card p-3", compact && "p-2.5")}>
        <div className="brand-gradient grid h-12 w-16 shrink-0 place-items-center rounded-md text-white">
          <Film className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{name}</span>
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          </div>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> Uploaded — Cloudflare is processing it, playable shortly
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={reset}><RefreshCw className="h-4 w-4" /> Replace</Button>
      </div>
    );
  }

  if (phase === "uploading") {
    return (
      <div className={cn("rounded-lg border bg-card p-3", compact && "p-2.5")}>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-16 shrink-0 place-items-center rounded-md bg-muted">
            <Film className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="truncate text-sm font-medium">{name}</span>
              <button onClick={reset} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <Meter value={progress} height={6} />
              <span className="w-28 shrink-0 text-right text-xs text-muted-foreground">
                {Math.round(progress)}% · uploading
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className={cn("rounded-lg border border-destructive/40 bg-destructive/5 p-3", compact && "p-2.5")}>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-16 shrink-0 place-items-center rounded-md bg-destructive/10">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="truncate text-sm font-medium">{name}</span>
            <p className="mt-0.5 text-xs text-destructive">{error}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={reset}><RefreshCw className="h-4 w-4" /> Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void upload(file);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-center transition-colors",
          compact ? "p-4" : "p-8",
          drag ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-muted/40",
        )}
      >
        <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
          <UploadCloud className="h-5 w-5" />
        </div>
        <span className="text-sm font-medium">Drag & drop a video, or click to upload</span>
        {!compact && (
          <span className="text-xs text-muted-foreground">
            MP4, MOV up to 5 GB · transcoded to adaptive HLS by Cloudflare Stream
          </span>
        )}
      </button>
    </>
  );
}
