import type { LessonType, UploadStatus } from "../enums.js";

export interface DirectUploadDto {
  /** One-time URL the client uploads the video file to. */
  uploadUrl: string;
  /** Cloudflare Stream video UID to persist on the lesson. */
  uid: string;
}

/** Returned when a tus upload reservation is created (Phase 2). */
export interface TusUploadDto {
  uploadId: string;
  uploadUrl: string;
  uid: string;
  expiresAt: string;
}

/** Owner-visible upload status for encoding progress UI. */
export interface UploadStatusDto {
  uploadId: string;
  uid: string | null;
  status: UploadStatus;
  failureReason: string | null;
  readyAt: string | null;
}

/** Returned after the client reports tus byte completion (Phase 2). */
export interface UploadCompleteDto {
  uploadId: string;
  uid: string;
  status: UploadStatus;
}

export interface PlaybackDto {
  lessonId: string;
  type: LessonType;
  ready: boolean;
  /** Signed HLS manifest URL (short-lived). Null for non-video lessons. */
  hlsUrl: string | null;
  /** Signed Cloudflare Stream iframe URL for the default player. */
  iframeUrl: string | null;
  /** Article body for ARTICLE lessons. */
  articleContent: string | null;
}
