"use client";

import { useEffect, useRef, useState } from "react";
import { init } from "pptx-preview";
import { Button } from "@/components/ui/button";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, Loader2 } from "lucide-react";
import { api } from "@/lib/api/endpoints";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function PptxViewer({
  courseId,
  lessonId,
  url,
}: {
  courseId: string;
  lessonId: string;
  url: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<ReturnType<typeof init> | null>(null);
  const currentSlideRef = useRef(1);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [slideCount, setSlideCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    let resizeFrame = 0;
    let rendering = false;
    let slideData: ArrayBuffer | null = null;
    let lastRenderedWidth = 0;

    setLoading(true);
    currentSlideRef.current = 1;
    setCurrentSlide(1);
    setSlideCount(0);
    api.pptxCompletion(courseId, lessonId).then((r) => { if (!cancelled) setCompleted(r.completed); }).catch(() => undefined);

    const renderAtCurrentSize = async () => {
      if (cancelled || !host.current || !slideData || rendering) return;
      const frame = host.current.parentElement;
      const availableWidth = frame?.clientWidth ?? host.current.clientWidth;
      const availableHeight = Math.max(240, window.innerHeight - 230);
      const width = Math.max(280, Math.min(Math.floor(availableWidth), Math.floor(availableHeight * 16 / 9)));
      const height = Math.round(width * 9 / 16);
      host.current.style.width = `${width}px`;
      host.current.style.height = `${height}px`;
      if (width === lastRenderedWidth && renderer.current) return;
      rendering = true;
      lastRenderedWidth = width;
      const selectedSlide = currentSlideRef.current;
      renderer.current?.destroy();
      host.current.innerHTML = "";
      const nextRenderer = init(host.current, { width, height, mode: "slide" });
      renderer.current = nextRenderer;
      await nextRenderer.preview(slideData);
      const targetSlide = Math.min(Math.max(selectedSlide - 1, 0), nextRenderer.slideCount - 1);
      for (let index = 0; index < targetSlide; index += 1) nextRenderer.renderNextSlide();
      if (!cancelled) {
        setSlideCount(nextRenderer.slideCount);
        setCurrentSlide(targetSlide + 1);
      }
      rendering = false;
    };

    (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Could not load the PowerPoint (" + response.status + ")");
        slideData = await response.arrayBuffer();
        if (cancelled || !host.current) return;
        await renderAtCurrentSize();
        resizeObserver = new ResizeObserver(() => {
          cancelAnimationFrame(resizeFrame);
          resizeFrame = requestAnimationFrame(() => { void renderAtCurrentSize(); });
        });
        resizeObserver.observe(host.current.parentElement ?? host.current);
        window.addEventListener("resize", renderAtCurrentSize);
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Could not load the PowerPoint.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      cancelAnimationFrame(resizeFrame);
      renderer.current?.destroy();
      renderer.current = null;
    };
  }, [courseId, lessonId, url]);

  function goPrevious() {
    const viewer = renderer.current;
    if (!viewer || slideCount < 2) return;
    viewer.renderPreSlide();
    setCurrentSlide((slide) => slide <= 1 ? slideCount : slide - 1);
  }

  function goNext() {
    const viewer = renderer.current;
    if (!viewer || slideCount < 2) return;
    viewer.renderNextSlide();
    setCurrentSlide((slide) => slide >= slideCount ? 1 : slide + 1);
  }

  async function markCompleted() {
    setSaving(true);
    try {
      const result = await api.setPptxCompletion(courseId, lessonId, !completed);
      setCompleted(result.completed);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save slide completion.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <style>{`.pptx-preview-wrapper-next,.pptx-preview-wrapper-pagination{display:none!important}.pptx-preview-wrapper{width:100%!important;height:100%!important;background:transparent!important}.pptx-preview-slide-wrapper{margin:0 auto!important;box-shadow:0 12px 30px rgb(15 23 42 / 0.14)}`}</style>
      <div className="relative flex justify-center overflow-hidden bg-gradient-to-br from-secondary/60 via-background to-primary/5 p-2 sm:p-5">
        {loading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm"><div className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm"><Loader2 className="size-4 animate-spin text-primary" /> Loading slides</div></div>}
        <div ref={host} className="mx-auto aspect-video w-full overflow-hidden rounded-xl" />
      </div>
      <div className="flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
        <Button variant="outline" size="sm" onClick={goPrevious} disabled={loading || slideCount < 2}>
          <ChevronLeft /> Previous
        </Button>
        <div className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-secondary sm:block">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: slideCount ? `${(currentSlide / slideCount) * 100}%` : "0%" }} />
        </div>
        <Button size="sm" onClick={goNext} disabled={loading || slideCount < 2}>
          Next <ChevronRight />
        </Button>
      </div>
      <div className="border-t bg-secondary/20 p-4 sm:px-5">
        <button type="button" onClick={markCompleted} disabled={loading || saving} className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors", completed ? "border-success/30 bg-success/5" : "border-border bg-card hover:bg-muted/60")}>
          <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-md border", completed ? "border-success bg-success text-success-foreground" : "border-muted-foreground/40")}>
            {completed ? <Check className="size-3.5" /> : <Circle className="size-3.5 text-transparent" />}
          </span>
          <span className="flex-1">
            <span className="block text-sm font-medium">I have completed this presentation</span>
            <span className="block text-xs text-muted-foreground">Your slide completion is saved to your learning progress.</span>
          </span>
          {completed && <CheckCircle2 className="size-5 text-success" />}
        </button>
      </div>
    </div>
  );
}
