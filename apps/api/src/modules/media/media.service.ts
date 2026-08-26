import { createPrivateKey, createSign } from "node:crypto";
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { DirectUploadDto, PlaybackDto } from "@skillstream/shared";
import { EnrollmentService } from "../enrollment/enrollment.service";
import { MediaRepository } from "./media.repository";
import { UploadRepository } from "./upload.repository";
import {
  assertAttachableUpload,
  type AssertAttachableUploadInput,
} from "./upload-validation";
import type { Env } from "../../config/env";

/** How long a signed playback token stays valid. Long enough to watch and
 *  re-scrub a full lesson; short enough that a leaked URL expires quickly. */
const TOKEN_TTL_SECONDS = 2 * 60 * 60;

/** Brand indigo (matches --primary in apps/web/app/globals.css) — Cloudflare
 *  Stream's iframe player supports a `primaryColor` query param that themes
 *  its native play button and seekbar. Left unset, every embed uses
 *  Cloudflare's default gray, which is the single biggest reason the player
 *  reads as generic/unbranded rather than a config gap in our own code. */
const PLAYER_PRIMARY_COLOR = "#4F46E5";

const b64url = (obj: unknown) =>
  Buffer.from(JSON.stringify(obj)).toString("base64url");

/**
 * Cloudflare Stream access rules binding a token to the requester's /24.
 * Would evaluate first-to-last, so an explicit allow of that range followed
 * by a catch-all block turns this into an allowlist; masked to /24 rather
 * than the exact address so a mobile carrier or router reassigning the
 * client's IP mid-session doesn't cut playback.
 */
// Disabled 2026-08-19: on Railway, this app never sees the visitor's real IP.
// Confirmed live — X-Forwarded-For/X-Real-Ip arrive already populated with
// two of Railway's own infra hops (their CDN partner + their GCP backend),
// never the client. Binding to that produced a token every real viewer
// failed, not a per-abuser restriction. Restore the /24-allowlist logic
// (see git history at this line) once Railway exposes a header that
// actually carries the client IP for this deployment — filed with their
// support along with the evidence.
export function ipAccessRules(_ip: string | undefined): unknown[] | undefined {
  return undefined;
}

/**
 * Signs a Cloudflare Stream playback JWT locally — no API round-trip. This is
 * the whole efficiency win: a signature is pure CPU (sub-millisecond) instead of
 * an HTTPS POST to Cloudflare on every play.
 *
 * `pem` is the RSA private key from Cloudflare's one-time `POST /stream/keys`.
 * `downloadable: false` blocks the MP4 download endpoint; `nbf`/`exp` bound the
 * window; `ip` (when parseable) binds the token to the requester's /24 via
 * `accessRules`, so a leaked token can't simply be replayed with a spoofed
 * `Referer` header from elsewhere — see `ipAccessRules`. `now` is injected so
 * tests use a fixed clock.
 */
export function signStreamToken(
  uid: string,
  keyId: string,
  pem: string,
  ip: string | undefined,
  now: Date = new Date(),
): string {
  const iat = Math.floor(now.getTime() / 1000);
  const header = { alg: "RS256", kid: keyId };
  const rules = ipAccessRules(ip);
  const payload = {
    sub: uid,
    kid: keyId,
    nbf: iat - 5, // small skew tolerance
    exp: iat + TOKEN_TTL_SECONDS,
    downloadable: false,
    ...(rules ? { accessRules: rules } : {}),
  };
  const data = `${b64url(header)}.${b64url(payload)}`;
  const signature = createSign("RSA-SHA256")
    .update(data)
    .sign(createPrivateKey(pem), "base64url");
  return `${data}.${signature}`;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly repo: MediaRepository,
    private readonly uploads: UploadRepository,
    private readonly enrollment: EnrollmentService,
  ) {}

  private cf() {
    const accountId = this.config.get("CLOUDFLARE_ACCOUNT_ID", { infer: true });
    const token = this.config.get("CLOUDFLARE_STREAM_TOKEN", { infer: true });
    if (!accountId || !token)
      throw new ServiceUnavailableException("Cloudflare Stream not configured");
    return { accountId, token };
  }

  /** Creates a one-time direct-creator-upload URL for an instructor. */
  async createDirectUpload(): Promise<DirectUploadDto> {
    const { accountId, token } = this.cf();
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ maxDurationSeconds: 7200, requireSignedURLs: true }),
      },
    );
    const json = (await res.json()) as {
      success: boolean;
      result?: { uploadURL: string; uid: string };
    };
    if (!json.success || !json.result)
      throw new ServiceUnavailableException("Failed to create upload URL");
    return { uploadUrl: json.result.uploadURL, uid: json.result.uid };
  }

  /**
   * Ensures a Cloudflare UID may be persisted on a lesson. Centralizes ownership,
   * status, and exclusivity rules for authoring create/update paths.
   */
  async assertAttachableUpload(input: AssertAttachableUploadInput): Promise<void> {
    const upload = await this.uploads.findByCloudflareUid(input.uid);
    assertAttachableUpload(upload, input);
  }

  /** Links an upload record to the lesson row after a successful attach. */
  async attachUploadToLesson(
    cloudflareUid: string,
    lessonId: string,
    courseId: string,
  ): Promise<void> {
    await this.uploads.attachToLesson(cloudflareUid, lessonId, courseId);
  }

  /** Clears lesson association when a video is removed from a lesson. */
  async detachUploadFromLesson(cloudflareUid: string): Promise<void> {
    const upload = await this.uploads.findByCloudflareUid(cloudflareUid);
    if (!upload) return;
    await this.uploads.detachFromLesson(cloudflareUid);
  }

  /** Returns signed playback for an enrolled (or preview) lesson. `userId` is
   *  undefined for logged-out visitors previewing free lessons. */
  async getPlayback(
    userId: string | undefined,
    lessonId: string,
    ip: string | undefined,
  ): Promise<PlaybackDto> {
    const lesson = await this.repo.findLessonForPlayback(lessonId);
    if (!lesson) throw new NotFoundException("Lesson not found");

    if (!lesson.preview) {
      const enrolled =
        !!userId &&
        (await this.enrollment.isEnrolled(userId, lesson.section.courseId));
      if (!enrolled) throw new ForbiddenException("Enroll to access this lesson");
    }

    // Preview lessons remain public for visitors, but an enrolled learner is
    // still bound to the course sequence. This prevents a direct playback
    // request from bypassing the curriculum sidebar lock.
    if (userId && (await this.enrollment.isEnrolled(userId, lesson.section.courseId))) {
      await this.enrollment.assertLessonAccessible(userId, lessonId);
    }

    if (lesson.type === "ARTICLE") {
      return {
        lessonId,
        type: lesson.type,
        ready: true,
        hlsUrl: null,
        iframeUrl: null,
        articleContent: lesson.articleContent,
      };
    }

    if (lesson.type !== "VIDEO" || !lesson.cfVideoUid) {
      return {
        lessonId,
        type: lesson.type,
        ready: false,
        hlsUrl: null,
        iframeUrl: null,
        articleContent: null,
      };
    }

    const token = await this.playbackToken(lesson.cfVideoUid, ip);
    const playerParams = new URLSearchParams({ primaryColor: PLAYER_PRIMARY_COLOR });
    return {
      lessonId,
      type: lesson.type,
      ready: true,
      hlsUrl: `https://videodelivery.net/${token}/manifest/video.m3u8`,
      iframeUrl: `https://iframe.videodelivery.net/${token}?${playerParams}`,
      articleContent: null,
    };
  }

  /** The locally-configured signing key, or null to fall back to the API path. */
  private localSigningKey(): { keyId: string; pem: string } | null {
    const keyId = this.config.get("CLOUDFLARE_STREAM_KEY_ID", { infer: true });
    const pemB64 = this.config.get("CLOUDFLARE_STREAM_KEY_PEM", { infer: true });
    if (!keyId || !pemB64) return null;
    // Stored base64-encoded (the raw PEM has newlines that don't survive .env).
    return { keyId, pem: Buffer.from(pemB64, "base64").toString("utf8") };
  }

  /**
   * A signed playback token for a Stream UID. Signs locally when a signing key
   * is configured (no network); otherwise falls back to Cloudflare's per-token
   * API so existing deployments keep working without a key.
   */
  private async playbackToken(uid: string, ip: string | undefined): Promise<string> {
    const key = this.localSigningKey();
    if (key) return signStreamToken(uid, key.keyId, key.pem, ip);
    return this.signStreamTokenViaApi(uid, ip);
  }

  /** Legacy fallback: ask Cloudflare to mint the token (one HTTPS call per play).
   *  Kept only for deployments that haven't provisioned a local signing key. */
  private async signStreamTokenViaApi(uid: string, ip: string | undefined): Promise<string> {
    const { accountId, token } = this.cf();
    const rules = ipAccessRules(ip);
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
          downloadable: false,
          ...(rules ? { accessRules: rules } : {}),
        }),
      },
    );
    const json = (await res.json()) as {
      success: boolean;
      result?: { token: string };
    };
    if (!json.success || !json.result)
      throw new ServiceUnavailableException("Failed to sign playback token");
    return json.result.token;
  }
}
