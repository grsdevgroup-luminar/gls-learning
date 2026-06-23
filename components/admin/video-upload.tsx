"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/shared/meter";
import { Badge } from "@/components/ui/badge";
import {
  UploadCloud, Film, CheckCircle2, Loader2, ShieldCheck, RefreshCw, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Phase = "idle" | "uploading" | "encoding" | "ready";

const sampleNames = ["lesson-final.mp4", "screen-recording.mov", "intro-take3.mp4", "module-2.mp4"];

export function VideoUpload({
  compact = false,
  initialReady = false,
  onReady,
}: {
  compact?: boolean;
  initialReady?: boolean;
  onReady?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>(initialReady ? "ready" : "idle");
  const [progress, setProgress] = useState(initialReady ? 100 : 0);
  const [name, setName] = useState(initialReady ? "lesson-final.mp4" : "");
  const [drag, setDrag] = useState(false);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);

  function start() {
    setName(sampleNames[Math.floor(Math.random() * sampleNames.length)]);
    setPhase("uploading");
    setProgress(0);
    const up = setInterval(() => {
      setProgress((p) => {
        const next = p + Math.random() * 18 + 6;
        if (next >= 100) {
          clearInterval(up);
          setPhase("encoding");
          const enc = setTimeout(() => {
            setPhase("ready");
            onReady?.();
          }, 1800);
          timers.current.push(enc as unknown as ReturnType<typeof setInterval>);
          return 100;
        }
        return next;
      });
    }, 350);
    timers.current.push(up);
  }

  function reset() {
    timers.current.forEach((t) => clearInterval(t));
    setPhase("idle");
    setProgress(0);
    setName("");
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
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="h-5 text-[10px]">1080p</Badge>
            <Badge variant="secondary" className="h-5 text-[10px]">720p</Badge>
            <Badge variant="secondary" className="h-5 text-[10px]">480p</Badge>
            <span className="inline-flex items-center gap-1 text-[11px] text-success">
              <ShieldCheck className="h-3 w-3" /> DRM ready
            </span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={reset}><RefreshCw className="h-4 w-4" /> Replace</Button>
      </div>
    );
  }

  if (phase === "uploading" || phase === "encoding") {
    return (
      <div className={cn("rounded-lg border bg-card p-3", compact && "p-2.5")}>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-16 shrink-0 place-items-center rounded-md bg-muted">
            {phase === "encoding" ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Film className="h-5 w-5 text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="truncate text-sm font-medium">{name}</span>
              <button onClick={reset} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <Meter value={phase === "encoding" ? 100 : progress} height={6} />
              <span className="w-28 shrink-0 text-right text-xs text-muted-foreground">
                {phase === "encoding" ? "Encoding…" : `${Math.round(progress)}% · uploading`}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); start(); }}
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
          MP4, MOV up to 5 GB · auto-transcoded to adaptive HLS with DRM
        </span>
      )}
    </button>
  );
}
