import { createPrivateKey, createSign } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UploadStatus, type Upload } from "@prisma/client";
import type {
  CreateTusUploadInput,
  DirectUploadDto,
  PlaybackDto,
  TusUploadDto,
  UploadCompleteDto,
  UploadStatusDto,
} from "@skillstream/shared";
import { MAX_VIDEO_BYTES } from "@skillstream/shared";
import type { RequestUser } from "../../common/decorators/decorators";
import { EnrollmentService } from "../enrollment/enrollment.service";
import {
  CloudflareTusInitError,
  encodeTusMetadata,
  fetchTusUploadProgress,
  isCloudflareEncodingFailed,
  isSupportedVideoFilename,
  parseCloudflareTusInitResponse,
  parseCloudflareVideoStatus,
  readCloudflareErrorMessage,
  tusUploadIsComplete,
  type CloudflareVideoStatus,
} from "./cloudflare-tus";
import { MediaRepository } from "./media.repository";
import { UploadRepository } from "./upload.repository";
import {
  assertAttachableUpload,
  assertDiscardableUpload,
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
  private readonly logger = new Logger(MediaService.name);

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

  /** Creates a tus resumable upload reservation (DB row first, then Cloudflare). */
  async createTusUpload(
    user: RequestUser,
    input: CreateTusUploadInput,
  ): Promise<TusUploadDto> {
    if (!isSupportedVideoFilename(input.filename)) {
      throw new BadRequestException(
        "Unsupported video format — use MP4, MOV, WebM, MKV, or M4V",
      );
    }
    if (input.bytes > MAX_VIDEO_BYTES) {
      throw new BadRequestException("Video exceeds the 30 GB maximum size");
    }

    const maxDurationCap = this.config.get("STREAM_MAX_DURATION_SECONDS", {
      infer: true,
    });
    const maxDurationSeconds = Math.min(
      input.maxDurationSeconds ?? maxDurationCap,
      maxDurationCap,
    );

    if (input.courseId) {
      await this.assertCourseAccess(input.courseId, user);
    }

    const maxOutstanding = this.config.get("STREAM_MAX_OUTSTANDING_UPLOADS", {
      infer: true,
    });
    const outstanding = await this.uploads.countOutstandingByOwner(user.id);
    if (outstanding >= maxOutstanding) {
      throw new HttpException(
        "Too many in-progress uploads — finish or discard one before starting another",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const reservationHours = this.config.get("STREAM_UPLOAD_RESERVATION_HOURS", {
      infer: true,
    });
    const expiresAt = new Date(Date.now() + reservationHours * 3_600_000);

    const upload = await this.uploads.create({
      ownerUserId: user.id,
      courseId: input.courseId ?? null,
      filename: input.filename,
      bytes: BigInt(input.bytes),
      status: UploadStatus.CREATED,
      expiresAt,
    });

    let cf: { uploadUrl: string; uid: string } | null = null;
    try {
      cf = await this.initiateCloudflareTus({
        bytes: input.bytes,
        filename: input.filename,
        maxDurationSeconds,
        expiry: expiresAt.toISOString(),
        creatorId: user.id,
      });

      const updated = await this.uploads.updateAfterCfInit(upload.id, {
        cloudflareUid: cf.uid,
        tusUploadUrl: cf.uploadUrl,
        expiresAt,
      });

      return {
        uploadId: updated.id,
        uploadUrl: cf.uploadUrl,
        uid: cf.uid,
        expiresAt: updated.expiresAt.toISOString(),
      };
    } catch (err) {
      if (cf?.uid) {
        await this.deleteCloudflareVideo(cf.uid).catch(() => undefined);
      }
      const reason =
        err instanceof CloudflareTusInitError
          ? err.providerMessage
          : (err as Error).message;
      if (err instanceof CloudflareTusInitError) {
        this.logger.warn(
          `Cloudflare tus init failed for upload ${upload.id}: ${err.httpStatus} ${err.providerMessage}`,
        );
      }
      await this.uploads.markFailed(upload.id, reason).catch(() => undefined);
      if (err instanceof CloudflareTusInitError) {
        throw new ServiceUnavailableException(
          "Failed to create tus upload with Cloudflare",
        );
      }
      throw err;
    }
  }

  /** Owner reports tus byte completion; advances upload to PROCESSING (or READY). */
  async completeUpload(
    user: RequestUser,
    uploadId: string,
  ): Promise<UploadCompleteDto> {
    const upload = await this.requireOwnedUpload(uploadId, user.id);

    if (upload.status === UploadStatus.PROCESSING || upload.status === UploadStatus.READY) {
      return this.toUploadCompleteDto(upload);
    }

    if (upload.status !== UploadStatus.UPLOADING) {
      throw new BadRequestException(
        `Upload cannot be completed (status: ${upload.status})`,
      );
    }

    if (!upload.cloudflareUid) {
      throw new BadRequestException("Upload has no Cloudflare video id");
    }

    if (!upload.tusUploadUrl) {
      throw new BadRequestException(
        "Upload is missing its tus endpoint — cannot verify byte completion",
      );
    }

    const progress = await fetchTusUploadProgress(upload.tusUploadUrl);
    if (!progress || !tusUploadIsComplete(progress, upload.bytes)) {
      throw new BadRequestException(
        "Upload is incomplete — not all bytes have been received by Cloudflare",
      );
    }

    const cfStatus = await this.fetchCloudflareVideo(upload.cloudflareUid);
    if (!cfStatus) {
      throw new BadRequestException(
        "Cloudflare has not received this upload yet — retry shortly",
      );
    }

    if (isCloudflareEncodingFailed(cfStatus.state)) {
      const updated = await this.uploads.markFailed(
        upload.id,
        cfStatus.errorReasonText ?? "Cloudflare reported an encoding error",
      );
      throw new BadRequestException(
        updated.failureReason ?? "Video encoding failed on Cloudflare",
      );
    }

    const updated = cfStatus.readyToStream
      ? await this.uploads.markReady(upload.id)
      : await this.uploads.markProcessing(upload.id);

    return this.toUploadCompleteDto(updated);
  }

  async getUploadStatus(
    user: RequestUser,
    uploadId: string,
  ): Promise<UploadStatusDto> {
    let upload = await this.requireOwnedUpload(uploadId, user.id);
    if (upload.status === UploadStatus.PROCESSING) {
      upload = await this.refreshEncodingStatus(upload);
    }
    return this.toUploadStatusDto(upload);
  }

  /** Permanently abandons an in-progress upload and best-effort deletes CF video. */
  async discardUpload(user: RequestUser, uploadId: string): Promise<void> {
    const upload = await this.requireOwnedUpload(uploadId, user.id);
    if (upload.status === UploadStatus.ABANDONED) return;

    assertDiscardableUpload(upload);

    await this.uploads.markAbandoned(upload.id);
    if (upload.cloudflareUid) {
      await this.deleteCloudflareVideo(upload.cloudflareUid);
    }
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

  private async assertCourseAccess(courseId: string, user: RequestUser) {
    const course = await this.repo.findCourseInstructor(courseId);
    if (!course) throw new NotFoundException("Course not found");
    if (user.role !== "ADMIN" && course.instructorId !== user.id) {
      throw new ForbiddenException("Not your course");
    }
  }

  private async requireOwnedUpload(uploadId: string, ownerUserId: string) {
    const upload = await this.uploads.findByIdAndOwner(uploadId, ownerUserId);
    if (!upload) throw new NotFoundException("Upload not found");
    return upload;
  }

  private toUploadStatusDto(upload: {
    id: string;
    cloudflareUid: string | null;
    status: UploadStatus;
    failureReason: string | null;
    readyAt: Date | null;
  }): UploadStatusDto {
    return {
      uploadId: upload.id,
      uid: upload.cloudflareUid,
      status: upload.status,
      failureReason: upload.failureReason,
      readyAt: upload.readyAt?.toISOString() ?? null,
    };
  }

  private toUploadCompleteDto(upload: {
    id: string;
    cloudflareUid: string | null;
    status: UploadStatus;
  }): UploadCompleteDto {
    if (!upload.cloudflareUid) {
      throw new ServiceUnavailableException("Upload is missing a Cloudflare video id");
    }
    return {
      uploadId: upload.id,
      uid: upload.cloudflareUid,
      status: upload.status,
    };
  }

  private async initiateCloudflareTus(input: {
    bytes: number;
    filename: string;
    maxDurationSeconds: number;
    expiry: string;
    creatorId: string;
  }): Promise<{ uploadUrl: string; uid: string }> {
    const { accountId, token } = this.cf();
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Tus-Resumable": "1.0.0",
          "Upload-Length": String(input.bytes),
          "Upload-Metadata": encodeTusMetadata({
            name: input.filename,
            maxDurationSeconds: input.maxDurationSeconds,
            requireSignedUrls: true,
            expiry: input.expiry,
          }),
          "Upload-Creator": input.creatorId,
        },
      },
    );

    const parsed = parseCloudflareTusInitResponse(res);
    if (!parsed) {
      const providerMessage = await readCloudflareErrorMessage(res);
      throw new CloudflareTusInitError(res.status, providerMessage);
    }
    return parsed;
  }

  private async fetchCloudflareVideo(
    uid: string,
  ): Promise<CloudflareVideoStatus | null> {
    try {
      const { accountId, token } = this.cf();
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const json = (await res.json()) as Parameters<typeof parseCloudflareVideoStatus>[0];
      return parseCloudflareVideoStatus(json);
    } catch {
      return null;
    }
  }

  /** Poll Cloudflare while PROCESSING until READY/FAILED (until webhooks ship). */
  private async refreshEncodingStatus(upload: Upload): Promise<Upload> {
    if (!upload.cloudflareUid || upload.status !== UploadStatus.PROCESSING) {
      return upload;
    }

    const cfStatus = await this.fetchCloudflareVideo(upload.cloudflareUid);
    if (!cfStatus) return upload;

    if (isCloudflareEncodingFailed(cfStatus.state)) {
      await this.uploads.markFailed(
        upload.id,
        cfStatus.errorReasonText ?? "Cloudflare reported an encoding error",
      );
    } else if (cfStatus.readyToStream) {
      await this.uploads.markReady(upload.id);
    } else {
      return upload;
    }

    return (
      (await this.uploads.findByIdAndOwner(upload.id, upload.ownerUserId)) ??
      upload
    );
  }

  private async deleteCloudflareVideo(uid: string): Promise<void> {
    try {
      const { accountId, token } = this.cf();
      await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
    } catch {
      /* Best-effort — orphan sweeps handle failures in Phase 7. */
    }
  }
}
