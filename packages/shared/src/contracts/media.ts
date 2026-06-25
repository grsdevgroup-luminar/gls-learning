import type { LessonType } from "../enums.js";

export interface DirectUploadDto {
  /** One-time URL the client uploads the video file to. */
  uploadUrl: string;
  /** Cloudflare Stream video UID to persist on the lesson. */
  uid: string;
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
