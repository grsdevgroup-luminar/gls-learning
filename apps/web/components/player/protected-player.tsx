'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/endpoints';
import { getApiErrorMessage } from '@/lib/api/errors';
import { gradientFor } from '@/lib/format';
import { AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const STREAM_ORIGIN = 'https://iframe.videodelivery.net';

// Renders whatever the lesson actually is (video / article / not-yet-uploaded)
// against the real, enrollment-gated `/lessons/:id/playback` endpoint. Video
// plays through Cloudflare Stream's own signed iframe embed, so we don't own
// any transcoding, HLS, or DRM logic here — just the enrollment-gated URL.
export function ProtectedPlayer({
  lessonId,
  title,
  watermark,
  seed = title,
  onComplete,
}: {
  lessonId: string;
  title: string;
  watermark: string;
  seed?: string;
  onComplete?: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['playback', lessonId],
    queryFn: () => api.playback(lessonId),
  });

  // Cloudflare's signed iframe embed posts player events to the parent window.
  useEffect(() => {
    if (!data?.ready || !data.iframeUrl) return;
    function onMessage(e: MessageEvent) {
      if (e.origin !== STREAM_ORIGIN) return;
      if ((e.data as { event?: string } | undefined)?.event === 'ended') onComplete?.();
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [data?.ready, data?.iframeUrl, onComplete]);

  if (isLoading) {
    return (
      <Frame seed={seed}>
        <Loader2 className="h-8 w-8 animate-spin text-white/70" />
      </Frame>
    );
  }

  if (error) {
    return (
      <Frame seed={seed}>
        <AlertTriangle className="h-8 w-8 text-white/70" />
        <p className="mt-2 max-w-xs text-center text-sm text-white/80">
          {getApiErrorMessage(error)}
        </p>
      </Frame>
    );
  }

  if (data?.type === 'ARTICLE') {
    return (
      <div className="rounded-xl border bg-card p-6">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {data.articleContent}
        </p>
      </div>
    );
  }

  if (!data?.ready || !data.iframeUrl) {
    return (
      <Frame seed={seed}>
        <Clock className="h-8 w-8 text-white/70" />
        <p className="mt-2 max-w-xs text-center text-sm text-white/80">
          This video isn&apos;t available yet — check back shortly.
        </p>
      </Frame>
    );
  }

  return (
    <div className="group relative w-full overflow-hidden rounded-xl bg-black">
      <div className="aspect-video">
        <iframe
          key={lessonId}
          src={data.iframeUrl}
          title={title}
          className="h-full w-full border-0"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>

      <Watermark text={watermark} />
    </div>
  );
}

function Frame({ seed, children }: { seed: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex aspect-video w-full flex-col items-center justify-center rounded-xl bg-black text-white',
      )}
      style={{ backgroundImage: gradientFor(seed) }}
    >
      <div className="relative z-10 flex flex-col items-center">{children}</div>
    </div>
  );
}

function Watermark({ text }: { text: string }) {
  const [pos, setPos] = useState({ x: 12, y: 60 });
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setPos({ x: 8 + Math.random() * 70, y: 25 + Math.random() * 55 });
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // Self-healing overlay: this is a DOM node next to the iframe, not pixels
  // burned into the video, so the naive bypass is one devtools line removing
  // or hiding it before a screen recording starts. Watching for that and
  // reinstating within a frame raises the bar from "one line" to "a script
  // that fights the observer" — it does not make this a real forensic
  // watermark. See the content-protection report, Gap 4, for the actual fix.
  useEffect(() => {
    const node = nodeRef.current;
    const parent = node?.parentElement;
    if (!node || !parent) return;

    const reinstate = () => {
      if (!node.isConnected) parent.appendChild(node);
      node.hidden = false;
      node.style.setProperty('display', 'block', 'important');
      node.style.setProperty('visibility', 'visible', 'important');
      node.style.setProperty('opacity', '1', 'important');
      node.style.setProperty('pointer-events', 'none', 'important');
    };

    const observer = new MutationObserver(reinstate);
    observer.observe(parent, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden'],
    });
    return () => observer.disconnect();
  }, []);

  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

  return (
    <div
      ref={nodeRef}
      className="pointer-events-none absolute z-20 text-[11px] font-medium text-white/35 transition-all duration-3000 ease-in-out"
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
    >
      {text} · {stamp} · GRS Learning
    </div>
  );
}

