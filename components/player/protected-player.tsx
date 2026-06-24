"use client";

import { useEffect, useRef, useState } from "react";
import { gradientFor, lessonTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Play, Pause, Volume2, VolumeX, Maximize, ShieldCheck, Settings,
  RotateCcw, SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// A simulated, DRM-styled video player. Demonstrates content protection
// (moving per-user watermark, disabled context menu, "protected" badge) without
// a real video file — perfect for the prototype.
export function ProtectedPlayer({
  title,
  durationSec,
  watermark,
  seed = title,
  onComplete,
  onNext,
  compact = false,
}: {
  title: string;
  durationSec: number;
  watermark: string;
  seed?: string;
  onComplete?: () => void;
  onNext?: () => void;
  compact?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Reset when the lesson changes
  useEffect(() => {
    setTime(0);
    setPlaying(false);
    setStarted(false);
  }, [title, durationSec]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setTime((t) => {
        const next = t + rate;
        if (next >= durationSec) {
          clearInterval(id);
          setPlaying(false);
          onComplete?.();
          return durationSec;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [playing, rate, durationSec, onComplete]);

  const pct = (time / durationSec) * 100;

  function toggle() {
    setStarted(true);
    setPlaying((p) => !p);
  }

  return (
    <div
      ref={ref}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "group relative w-full select-none overflow-hidden rounded-xl bg-black text-white",
        compact ? "aspect-video" : "aspect-video",
      )}
      style={{ backgroundImage: gradientFor(seed) }}
    >
      {/* fake video texture */}
      <div className="absolute inset-0 bg-black/35" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(circle_at_30%_30%,rgba(255,255,255,.25),transparent_45%)]" />

      {/* moving per-user watermark (anti-piracy) */}
      <Watermark text={watermark} />

      {/* protected badge */}
      <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs backdrop-blur">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
        DRM protected
      </div>

      {/* center play */}
      {!playing && (
        <button
          onClick={toggle}
          className="absolute inset-0 z-20 grid place-items-center"
          aria-label="Play"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-white/90 text-black shadow-lg transition-transform hover:scale-105">
            {time >= durationSec ? <RotateCcw className="h-7 w-7" /> : <Play className="ml-1 h-7 w-7 fill-black" />}
          </span>
        </button>
      )}

      {/* title */}
      {!started && (
        <div className="absolute left-4 top-12 z-10 max-w-[70%]">
          <p className="text-xs uppercase tracking-wide text-white/70">Now playing</p>
          <p className="text-lg font-semibold drop-shadow">{title}</p>
        </div>
      )}

      {/* clickable area to pause */}
      {playing && <button onClick={toggle} className="absolute inset-0 z-10" aria-label="Pause" />}

      {/* controls */}
      <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/80 to-transparent p-3">
        <input
          type="range"
          min={0}
          max={durationSec}
          value={time}
          onChange={(e) => { setStarted(true); setTime(Number(e.target.value)); }}
          className="mb-2 h-1 w-full cursor-pointer appearance-none rounded-full bg-white/30 accent-white [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
          style={{ background: `linear-gradient(to right, white ${pct}%, rgba(255,255,255,.3) ${pct}%)` }}
        />
        <div className="flex items-center gap-2 text-sm">
          <button onClick={toggle} aria-label="Play/Pause">
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          {onNext && (
            <button onClick={onNext} aria-label="Next lesson"><SkipForward className="h-5 w-5" /></button>
          )}
          <button onClick={() => setMuted((m) => !m)} aria-label="Mute">
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <span className="tabular-nums text-xs text-white/90">
            {lessonTime(Math.floor(time))} / {lessonTime(durationSec)}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" className="text-white hover:bg-white/20 hover:text-white" />}
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Playback speed</DropdownMenuLabel>
                {[0.5, 1, 1.25, 1.5, 2].map((r) => (
                  <DropdownMenuItem key={r} onClick={() => setRate(r)}>
                    {rate === r ? "● " : ""}{r}×
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button aria-label="Fullscreen"><Maximize className="h-5 w-5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Watermark({ text }: { text: string }) {
  const [pos, setPos] = useState({ x: 12, y: 60 });
  useEffect(() => {
    const id = setInterval(() => {
      setPos({ x: 8 + Math.random() * 70, y: 25 + Math.random() * 55 });
    }, 4000);
    return () => clearInterval(id);
  }, []);
  return (
    <div
      className="pointer-events-none absolute z-20 text-[11px] font-medium text-white/35 transition-all duration-[3000ms] ease-in-out"
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
    >
      {text} · SkillStream
    </div>
  );
}
