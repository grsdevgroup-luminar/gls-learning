import { z } from "zod";
import type { LessonType, UploadStatus } from "../enums.js";

export const SUPPORTED_VIDEO_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".webm",
  ".mkv",
  ".m4v",
] as const;

/** 30 GiB — Cloudflare Stream tus limit. */
export const MAX_VIDEO_BYTES = 30 * 1024 * 1024 * 1024;

export const DEFAULT_MAX_DURATION_SECONDS = 7200;

export const createTusUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  bytes: z.number().int().positive().max(MAX_VIDEO_BYTES),
  maxDurationSeconds: z.number().int().positive().optional(),
  courseId: z.string().min(1).optional(),
});
export type CreateTusUploadInput = z.infer<typeof createTusUploadSchema>;

export interface TusInitiationMetadata {
  name: string;
  maxDurationSeconds: number;
  requireSignedUrls: boolean;
  /** RFC3339 timestamp, e.g. `2026-08-28T03:00:00.000Z` */
  expiry: string;
}

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
