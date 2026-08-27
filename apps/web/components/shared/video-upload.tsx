"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/shared/meter";
import {
  UploadCloud,
  Film,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Pause,
  Play,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authoringApi } from "@/lib/api/endpoints";
import { ApiError, getApiErrorMessage } from "@/lib/api/errors";
import { toast } from "sonner";
import { MAX_VIDEO_BYTES } from "@skillstream/shared";
import type { UploadStatus } from "@skillstream/shared";
import {
  clearVideoUploadDraft,
  readVideoUploadDraft,
  writeVideoUploadDraft,
  type VideoUploadDraft,
} from "@/lib/video-upload-draft";
import {
  isSupportedVideoFile,
  videoFileFingerprint,
} from "@/lib/video-file-fingerprint";

const CHUNK_SIZE = 50 * 1024 * 1024;
const RETRY_DELAYS = [0, 1_000, 3_000, 5_000, 10_000] as const;
const ENCODING_POLL_MS = 4_000;

type TransportPhase =
  | "idle"
  | "uploading"
  | "paused"
  | "retrying"
  | "uploaded"
  | "replacing"
  | "error";

type EncodingPhase = "unknown" | "processing" | "playable" | "failed";

export interface UploadedVideoPayload {
  uploadId: string;
  uid: string;
  filename: string;
  durationSec?: number;
}

export interface CommittedVideo {
  uid: string;
  uploadId: string | null;
  label?: string;
}

function encodingFromStatus(status: UploadStatus): EncodingPhase {
  if (status === "READY") return "playable";
  if (status === "FAILED") return "failed";
  if (status === "PROCESSING") return "processing";
  return "unknown";
}

function isDiscardNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

/** Reads the real length of a video file straight from its container metadata
 *  via a hidden <video> element — instant, and doesn't depend on Cloudflare's
 *  async transcode (which takes time to expose `duration` on its own API). */
function readVideoDurationSec(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement("video");
      video.preload = "metadata";
      const url = URL.createObjectURL(file);
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(video.duration) && video.duration > 0 ? Math.round(video.duration) : undefined);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(undefined);
      };
      video.src = url;
    } catch {
      resolve(undefined);
    }
  });
}

export function VideoUpload({
  compact = false,
  initiallyUploaded = false,
  courseId,
  lessonId,
  initialUploadId = null,
  committedVideo = null,
  replacingVideo = false,
  onUploaded,
  onReplaceRequested,
  onReplaceCancelled,
}: {
  compact?: boolean;
  initiallyUploaded?: boolean;
  courseId?: string;
  lessonId: string;
  initialUploadId?: string | null;
  /** Video already bound in builder state — kept until a replacement upload succeeds. */
  committedVideo?: CommittedVideo | null;
  /** Parent is in replace mode — keeps committed UID until a new upload succeeds. */
  replacingVideo?: boolean;
  onUploaded?: (payload: UploadedVideoPayload) => void;
  onReplaceRequested?: () => void;
  onReplaceCancelled?: () => void;
}) {
  const [transport, setTransport] = useState<TransportPhase>(
    initiallyUploaded ? "uploaded" : "idle",
  );
  const [encoding, setEncoding] = useState<EncodingPhase>("unknown");
  const [progress, setProgress] = useState(initiallyUploaded ? 100 : 0);
  const [name, setName] = useState(
    initiallyUploaded ? (committedVideo?.label ?? "Uploaded video") : "",
  );
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<VideoUploadDraft | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const tusRef = useRef<tus.Upload | null>(null);
  const uploadIdRef = useRef<string | null>(initialUploadId);
  const uidRef = useRef<string | null>(committedVideo?.uid ?? null);
  const encodingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  const stopEncodingPoll = useCallback(() => {
    if (encodingPollRef.current) {
      clearInterval(encodingPollRef.current);
      encodingPollRef.current = null;
    }
  }, []);

  const persistDraft = useCallback(
    (draft: VideoUploadDraft) => {
      writeVideoUploadDraft(courseId, lessonId, draft);
      setPendingDraft(draft);
    },
    [courseId, lessonId],
  );

  const pollEncodingStatus = useCallback(
    (uploadId: string) => {
      stopEncodingPoll();
      encodingPollRef.current = setInterval(() => {
        void (async () => {
          if (!mountedRef.current) return;
          try {
            const status = await authoringApi.getUploadStatus(uploadId);
            if (!mountedRef.current) return;
            const next = encodingFromStatus(status.status);
            setEncoding(next);
            if (next === "playable" || next === "failed") {
              stopEncodingPoll();
              if (next === "failed" && status.failureReason) {
                setError(status.failureReason);
              }
            }
          } catch {
            /* Keep polling — transient network blips are common mid-encoding. */
          }
        })();
      }, ENCODING_POLL_MS);
    },
    [stopEncodingPoll],
  );

  const applyUploadedState = useCallback(
    (payload: UploadedVideoPayload, status: UploadStatus) => {
      uidRef.current = payload.uid;
      uploadIdRef.current = payload.uploadId;
      clearVideoUploadDraft(courseId, lessonId);
      setPendingDraft(null);
      setName(payload.filename);
      setTransport("uploaded");
      setProgress(100);
      const enc = encodingFromStatus(status);
      setEncoding(enc);
      onUploadedRef.current?.(payload);
      if (enc === "processing") pollEncodingStatus(payload.uploadId);
    },
    [courseId, lessonId, pollEncodingStatus],
  );

  const recoverDraftOnMount = useCallback(
    async (draft: VideoUploadDraft) => {
      uploadIdRef.current = draft.uploadId;
      uidRef.current = draft.uid;
      setName(draft.filename);
      setPendingDraft(draft);

      try {
        const status = await authoringApi.getUploadStatus(draft.uploadId);
        if (!mountedRef.current) return;

        if (status.status === "PROCESSING" || status.status === "READY") {
          applyUploadedState(
            { uploadId: draft.uploadId, uid: draft.uid, filename: draft.filename },
            status.status,
          );
          return;
        }
      } catch {
        /* Fall through to paused — draft may still be resumable. */
      }

      if (!mountedRef.current) return;
      setTransport("paused");
      setProgress(0);
    },
    [applyUploadedState],
  );

  useEffect(() => {
    mountedRef.current = true;
    const draft = readVideoUploadDraft(courseId, lessonId);
    if (draft) void recoverDraftOnMount(draft);

    return () => {
      mountedRef.current = false;
      stopEncodingPoll();

      const upload = tusRef.current;
      if (upload) {
        try {
          upload.abort(false);
        } catch {
          /* Pausing on unmount is best-effort. */
        }
        const currentDraft = readVideoUploadDraft(courseId, lessonId);
        if (currentDraft && upload.url) {
          writeVideoUploadDraft(courseId, lessonId, {
            ...currentDraft,
            uploadUrl: upload.url,
          });
        }
        tusRef.current = null;
      }
    };
  }, [courseId, lessonId, recoverDraftOnMount, stopEncodingPoll]);

  useEffect(() => {
    if (!initialUploadId || transport !== "uploaded") return;
    uploadIdRef.current = initialUploadId;
    void authoringApi
      .getUploadStatus(initialUploadId)
      .then((status) => {
        if (!mountedRef.current) return;
        const next = encodingFromStatus(status.status);
        setEncoding(next);
        if (next === "processing") pollEncodingStatus(initialUploadId);
        if (next === "failed" && status.failureReason) {
          setError(status.failureReason);
        }
      })
      .catch(() => undefined);
  }, [initialUploadId, transport, pollEncodingStatus]);

  useEffect(() => {
    if (replacingVideo) setTransport("replacing");
  }, [replacingVideo]);

  function transportLabel(): string {
    if (transport === "uploading") return "uploading";
    if (transport === "paused") return "paused";
    if (transport === "retrying") return "retrying";
    if (transport === "uploaded") {
      if (encoding === "processing") return "processing";
      if (encoding === "playable") return "playable";
      if (encoding === "failed") return "encoding failed";
      return "uploaded";
    }
    return "";
  }

  async function finalizeUpload(
    uploadId: string,
    filename: string,
    durationSec?: number,
  ) {
    const result = await authoringApi.completeUpload(uploadId);
    if (!mountedRef.current) return;

    applyUploadedState(
      { uploadId, uid: result.uid, filename, durationSec },
      result.status,
    );
  }

  async function startTusUpload(file: File, draft?: VideoUploadDraft | null) {
    let uploadId = draft?.uploadId ?? null;
    let uploadUrl = draft?.uploadUrl ?? null;
    let uid = draft?.uid ?? null;
    let expiresAt = draft?.expiresAt ?? null;

    if (!uploadUrl || !uploadId || !uid || !expiresAt) {
      const created = await authoringApi.createTusUpload({
        filename: file.name,
        bytes: file.size,
        ...(courseId ? { courseId } : {}),
      });
      uploadId = created.uploadId;
      uploadUrl = created.uploadUrl;
      uid = created.uid;
      expiresAt = created.expiresAt;
    }

    const fingerprint = videoFileFingerprint(file);
    const nextDraft: VideoUploadDraft = {
      uploadId,
      uploadUrl,
      uid,
      fileFingerprint: fingerprint,
      filename: file.name,
      expiresAt,
    };
    persistDraft(nextDraft);
    uploadIdRef.current = uploadId;
    uidRef.current = uid;

    const filename = file.name;
    const durationSecPromise = readVideoDurationSec(file);

    return new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(file, {
        uploadUrl,
        chunkSize: CHUNK_SIZE,
        retryDelays: [...RETRY_DELAYS],
        storeFingerprintForResuming: true,
        removeFingerprintOnSuccess: true,
        fingerprint: async () => `skillstream:${courseId ?? "new"}:${lessonId}:${fingerprint}`,
        metadata: {
          filename: file.name,
          filetype: file.type || "video/mp4",
        },
        onError: (err) => {
          if (!mountedRef.current) {
            reject(err);
            return;
          }
          tusRef.current = null;
          if (upload.url) {
            persistDraft({ ...nextDraft, uploadUrl: upload.url });
          }
          reject(err);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          if (!mountedRef.current) return;
          if (bytesTotal > 0) {
            setProgress((bytesUploaded / bytesTotal) * 100);
          }
        },
        onShouldRetry: () => {
          if (mountedRef.current) setTransport("retrying");
          return true;
        },
        onSuccess: () => {
          tusRef.current = null;
          resolve();
        },
      });

      tusRef.current = upload;
      upload.start();
    }).then(async () => {
      const durationSec = await durationSecPromise;
      await finalizeUpload(uploadId!, filename, durationSec);
    });
  }

  async function upload(file: File) {
    if (!file.type.startsWith("video/") && !isSupportedVideoFile(file)) {
      toast.error("Please choose a video file");
      return;
    }
    if (!isSupportedVideoFile(file)) {
      toast.error("Use MP4, MOV, WebM, MKV, or M4V");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error("Video is larger than 30 GB");
      return;
    }

    const fingerprint = videoFileFingerprint(file);
    const draft = readVideoUploadDraft(courseId, lessonId);
    const canResume =
      draft &&
      draft.fileFingerprint === fingerprint &&
      Date.parse(draft.expiresAt) > Date.now();

    setName(file.name);
    setError("");
    setEncoding("unknown");
    setTransport("uploading");
    setProgress(0);

    try {
      await startTusUpload(file, canResume ? draft : null);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(getApiErrorMessage(e));
      setTransport("error");
    }
  }

  function pauseUpload() {
    const upload = tusRef.current;
    if (!upload) return;
    upload.abort(false);
    setTransport("paused");
  }

  function resumeUpload() {
    const upload = tusRef.current;
    if (!upload) {
      inputRef.current?.click();
      return;
    }
    setTransport("uploading");
    upload.start();
  }

  function restoreCommittedView(): boolean {
    if (!committedVideo) return false;
    uploadIdRef.current = committedVideo.uploadId;
    uidRef.current = committedVideo.uid;
    setName(committedVideo.label ?? "Uploaded video");
    setPendingDraft(null);
    setTransport("uploaded");
    setProgress(100);
    setEncoding("unknown");
    setError("");
    return true;
  }

  async function discardUpload() {
    stopEncodingPoll();

    const upload = tusRef.current;
    if (upload) {
      upload.abort(false);
      tusRef.current = null;
    }

    const uploadId = uploadIdRef.current;
    const wasReplacing = replacingVideo;

    if (uploadId) {
      try {
        await authoringApi.discardUpload(uploadId);
      } catch (e) {
        if (isDiscardNotFound(e)) {
          /* Server record already removed — clear local state below. */
        } else if (e instanceof ApiError && e.status === 409) {
          const message = getApiErrorMessage(e);
          setError(message);
          setTransport("error");
          toast.error(
            "This upload is linked to a lesson — remove or replace the video on the lesson instead",
          );
          if (wasReplacing) {
            onReplaceCancelled?.();
            restoreCommittedView();
          }
          return;
        } else {
          const message = getApiErrorMessage(e);
          setError(message);
          setTransport("error");
          toast.error("Could not discard upload — try again when you're back online");
          return;
        }
      }
    }

    clearVideoUploadDraft(courseId, lessonId);
    setPendingDraft(null);

    if (wasReplacing) {
      onReplaceCancelled?.();
      if (!restoreCommittedView()) {
        uploadIdRef.current = null;
        uidRef.current = null;
        setTransport("idle");
        setEncoding("unknown");
        setProgress(0);
        setName("");
        setError("");
      }
      return;
    }

    uploadIdRef.current = null;
    uidRef.current = null;
    setTransport("idle");
    setEncoding("unknown");
    setProgress(0);
    setName("");
    setError("");
  }

  function beginReplace() {
    stopEncodingPoll();
    onReplaceRequested?.();
    setTransport("replacing");
    setError("");
    setProgress(0);
  }

  function cancelReplace() {
    onReplaceCancelled?.();
    setTransport("uploaded");
    setProgress(100);
    setName((committedVideo?.label ?? name) || "Uploaded video");
    setError("");
  }

  const fileInput = (
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
  );

  const dropZone = (replacing: boolean) => (
  <button
    type="button"
    onClick={() => inputRef.current?.click()}
    onDragOver={(e) => {
      e.preventDefault();
      setDrag(true);
    }}
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
    <span className="text-sm font-medium">
      {replacing ? "Choose a replacement video" : "Drag & drop a video, or click to upload"}
    </span>
    {replacing && committedVideo && (
      <span className="text-xs text-muted-foreground">
        The current video stays saved until the new upload finishes
      </span>
    )}
    {!replacing && pendingDraft && (
      <span className="text-xs text-primary">
        Unfinished upload for {pendingDraft.filename} — select the same file to resume
      </span>
    )}
    {!compact && !replacing && (
      <span className="text-xs text-muted-foreground">
        MP4, MOV, WebM up to 30 GB · resumable · transcoded to adaptive HLS by Cloudflare Stream
      </span>
    )}
  </button>
  );

  if (transport === "uploaded") {
    const encodingNote =
      encoding === "playable"
        ? "Ready for playback after you save the course"
        : encoding === "failed"
          ? "Cloudflare could not process this video"
          : encoding === "processing"
            ? "Uploaded — Cloudflare is processing it, playable shortly"
            : "Uploaded — processing will begin shortly";

    return (
      <div className={cn("flex items-center gap-3 rounded-lg border bg-card p-3", compact && "p-2.5")}>
        <div className="brand-gradient grid h-12 w-16 shrink-0 place-items-center rounded-md text-white">
          <Film className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{name}</span>
            <CheckCircle2
              className={cn(
                "h-4 w-4 shrink-0",
                encoding === "failed" ? "text-destructive" : "text-success",
              )}
            />
          </div>
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-[11px]",
              encoding === "failed" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            <ShieldCheck className="h-3 w-3" /> {encodingNote}
          </p>
          {encoding === "failed" && error && (
            <p className="mt-0.5 text-[11px] text-destructive">{error}</p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={beginReplace}>
          <RefreshCw className="h-4 w-4" /> Replace
        </Button>
      </div>
    );
  }

  if (transport === "replacing") {
    return (
      <div className={cn("space-y-2 rounded-lg border bg-card p-3", compact && "p-2.5")}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Replacing{" "}
            <span className="font-medium text-foreground">
              {(committedVideo?.label ?? name) || "current video"}
            </span>
            . Your saved video is unchanged until the new upload completes.
          </p>
          <Button variant="ghost" size="sm" onClick={cancelReplace}>
            <X className="h-4 w-4" /> Keep current
          </Button>
        </div>
        {fileInput}
        {dropZone(true)}
      </div>
    );
  }

  if (transport === "uploading" || transport === "retrying" || transport === "paused") {
    return (
      <div className={cn("rounded-lg border bg-card p-3", compact && "p-2.5")}>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-16 shrink-0 place-items-center rounded-md bg-muted">
            <Film className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{name}</span>
              <div className="flex shrink-0 items-center gap-1">
                {transport === "paused" ? (
                  <Button variant="ghost" size="sm" onClick={resumeUpload}>
                    <Play className="h-4 w-4" /> Resume
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={pauseUpload}>
                    <Pause className="h-4 w-4" /> Pause
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => void discardUpload()}>
                  <Trash2 className="h-4 w-4" /> Discard
                </Button>
              </div>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <Meter value={progress} height={6} />
              <span className="w-32 shrink-0 text-right text-xs text-muted-foreground">
                {Math.round(progress)}% · {transportLabel()}
              </span>
            </div>
            {transport === "paused" && pendingDraft && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Select the same file to resume this upload.
              </p>
            )}
          </div>
        </div>
        {fileInput}
      </div>
    );
  }

  if (transport === "error") {
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
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void discardUpload()}>
              <Trash2 className="h-4 w-4" /> Discard
            </Button>
          </div>
        </div>
        {fileInput}
      </div>
    );
  }

  return (
    <>
      {fileInput}
      {dropZone(false)}
    </>
  );
}
