import { createHmac, generateKeyPairSync } from "node:crypto";
import { beforeAll, describe, it, expect, vi } from "vitest";
import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { LessonType, UploadStatus, type Upload } from "@prisma/client";
import type { ConfigService } from "@nestjs/config";
import { MediaService } from "../media.service";
import type { MediaRepository } from "../media.repository";
import type { UploadRepository } from "../upload.repository";
import type { EnrollmentService } from "../../enrollment/enrollment.service";
import type { Env } from "../../../config/env";

const webhookSecret = "85011ed3a913c6ad5f9cf6c5573cc0a7";
let signingPemB64: string;
let signingKeyId: string;

beforeAll(() => {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = pair.privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString();
  signingPemB64 = Buffer.from(pem, "utf8").toString("base64");
  signingKeyId = "test_stream_key";
});

function signWebhook(body: string, nowMs: number = Date.now()) {
  const time = String(Math.floor(nowMs / 1000));
  const raw = Buffer.from(body, "utf8");
  const source = Buffer.concat([Buffer.from(`${time}.`, "utf8"), raw]);
  const sig1 = createHmac("sha256", webhookSecret).update(source).digest("hex");
  return { raw, header: `time=${time},sig1=${sig1}` };
}

function makeUpload(overrides: Partial<Upload> = {}): Upload {
  return {
    id: "upload_1",
    ownerUserId: "user_1",
    courseId: null,
    lessonId: null,
    cloudflareUid: "cf_vid_1",
    tusUploadUrl: "https://upload.example/tus/1",
    filename: "lesson.mp4",
    bytes: 1024n,
    fileFingerprint: null,
    status: UploadStatus.PROCESSING,
    failureReason: null,
    expiresAt: new Date("2026-09-01T00:00:00.000Z"),
    completedAt: null,
    readyAt: null,
    createdAt: new Date("2026-08-27T00:00:00.000Z"),
    updatedAt: new Date("2026-08-27T00:00:00.000Z"),
    ...overrides,
  };
}

function makeService(overrides: {
  config?: Partial<Record<keyof Env, unknown>>;
  repo?: Partial<MediaRepository>;
  uploads?: Partial<UploadRepository>;
  enrollment?: Partial<EnrollmentService>;
}) {
  const config = {
    get: vi.fn((key: keyof Env) => {
      const values: Partial<Record<keyof Env, unknown>> = {
        CLOUDFLARE_STREAM_WEBHOOK_SECRET: webhookSecret,
        CLOUDFLARE_STREAM_KEY_ID: signingKeyId,
        CLOUDFLARE_STREAM_KEY_PEM: signingPemB64,
        CLOUDFLARE_ACCOUNT_ID: "acct",
        CLOUDFLARE_STREAM_TOKEN: "token",
        ...overrides.config,
      };
      return values[key];
    }),
  } as unknown as ConfigService<Env, true>;

  const repo = {
    findLessonForPlayback: vi.fn(),
    findCourseInstructor: vi.fn(),
    ...overrides.repo,
  } as unknown as MediaRepository;

  const uploads = {
    findByCloudflareUid: vi.fn(),
    markReadyFromEncoding: vi.fn().mockResolvedValue(true),
    markFailedFromEncoding: vi.fn().mockResolvedValue(true),
    ...overrides.uploads,
  } as unknown as UploadRepository;

  const enrollment = {
    isEnrolled: vi.fn().mockResolvedValue(false),
    assertLessonAccessible: vi.fn().mockResolvedValue(undefined),
    ...overrides.enrollment,
  } as unknown as EnrollmentService;

  return {
    service: new MediaService(config, repo, uploads, enrollment),
    repo,
    uploads,
    enrollment,
    config,
  };
}

describe("MediaService.handleStreamWebhook", () => {
  it("rejects when the webhook secret is not configured", async () => {
    const { service } = makeService({
      config: { CLOUDFLARE_STREAM_WEBHOOK_SECRET: undefined },
    });
    await expect(
      service.handleStreamWebhook(Buffer.from("{}"), "time=1,sig1=x"),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("rejects invalid signatures without touching the database", async () => {
    const { service, uploads } = makeService({});
    await expect(
      service.handleStreamWebhook(Buffer.from("{}"), "time=1,sig1=bad"),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(uploads.findByCloudflareUid).not.toHaveBeenCalled();
  });

  it("marks the matching upload READY for a valid ready webhook", async () => {
    const body = JSON.stringify({
      uid: "cf_vid_1",
      readyToStream: true,
      status: { state: "ready" },
    });
    const { raw, header } = signWebhook(body);
    const upload = makeUpload();
    const { service, uploads } = makeService({
      uploads: {
        findByCloudflareUid: vi.fn().mockResolvedValue(upload),
      },
    });

    await service.handleStreamWebhook(raw, header);

    expect(uploads.markReadyFromEncoding).toHaveBeenCalledWith(upload.id);
    expect(uploads.markFailedFromEncoding).not.toHaveBeenCalled();
  });

  it("acknowledges unknown Cloudflare UIDs without writing", async () => {
    const body = JSON.stringify({
      uid: "missing",
      readyToStream: true,
      status: { state: "ready" },
    });
    const { raw, header } = signWebhook(body);
    const { service, uploads } = makeService({
      uploads: { findByCloudflareUid: vi.fn().mockResolvedValue(null) },
    });

    await service.handleStreamWebhook(raw, header);

    expect(uploads.markReadyFromEncoding).not.toHaveBeenCalled();
    expect(uploads.markFailedFromEncoding).not.toHaveBeenCalled();
  });

  it("does not overwrite terminal uploads when the conditional update misses", async () => {
    const body = JSON.stringify({
      uid: "cf_vid_1",
      readyToStream: true,
      status: { state: "ready" },
    });
    const { raw, header } = signWebhook(body);
    const { service, uploads } = makeService({
      uploads: {
        findByCloudflareUid: vi.fn().mockResolvedValue(makeUpload({ status: UploadStatus.READY })),
        markReadyFromEncoding: vi.fn().mockResolvedValue(false),
      },
    });

    await service.handleStreamWebhook(raw, header);

    expect(uploads.markReadyFromEncoding).toHaveBeenCalledWith("upload_1");
  });

  it("marks FAILED for encoding error webhooks", async () => {
    const body = JSON.stringify({
      uid: "cf_vid_1",
      readyToStream: false,
      status: { state: "error", errReasonText: "Corrupt file" },
    });
    const { raw, header } = signWebhook(body);
    const { service, uploads } = makeService({
      uploads: {
        findByCloudflareUid: vi.fn().mockResolvedValue(makeUpload()),
      },
    });

    await service.handleStreamWebhook(raw, header);

    expect(uploads.markFailedFromEncoding).toHaveBeenCalledWith(
      "upload_1",
      "Corrupt file",
    );
  });
});

describe("MediaService.getPlayback", () => {
  const lesson = {
    id: "lesson_1",
    type: LessonType.VIDEO,
    preview: true,
    articleContent: null,
    cfVideoUid: "cf_vid_1",
    section: { courseId: "course_1" },
  };

  it("returns not-ready for PROCESSING uploads without calling Cloudflare", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { service, repo, uploads } = makeService({
      repo: { findLessonForPlayback: vi.fn().mockResolvedValue(lesson) },
      uploads: {
        findByCloudflareUid: vi.fn().mockResolvedValue(makeUpload({
          status: UploadStatus.PROCESSING,
        })),
      },
    });

    const result = await service.getPlayback(undefined, "lesson_1", undefined);

    expect(result.ready).toBe(false);
    expect(result.hlsUrl).toBeNull();
    expect(result.iframeUrl).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("returns signed playback URLs for READY uploads", async () => {
    const { service, repo, uploads } = makeService({
      repo: { findLessonForPlayback: vi.fn().mockResolvedValue(lesson) },
      uploads: {
        findByCloudflareUid: vi.fn().mockResolvedValue(makeUpload({
          status: UploadStatus.READY,
        })),
      },
    });

    const result = await service.getPlayback(undefined, "lesson_1", undefined);

    expect(result.ready).toBe(true);
    expect(result.hlsUrl).toMatch(/^https:\/\/videodelivery\.net\/.+\/manifest\/video\.m3u8$/);
    expect(result.iframeUrl).toMatch(/^https:\/\/iframe\.videodelivery\.net\/.+/);
  });

  it("grandfathers lessons with a UID but no Upload row", async () => {
    const { service, repo, uploads } = makeService({
      repo: { findLessonForPlayback: vi.fn().mockResolvedValue(lesson) },
      uploads: { findByCloudflareUid: vi.fn().mockResolvedValue(null) },
    });

    const result = await service.getPlayback(undefined, "lesson_1", undefined);

    expect(result.ready).toBe(true);
    expect(result.hlsUrl).toContain("videodelivery.net");
  });

  it("blocks playback for ABANDONED uploads", async () => {
    const { service, repo, uploads } = makeService({
      repo: { findLessonForPlayback: vi.fn().mockResolvedValue(lesson) },
      uploads: {
        findByCloudflareUid: vi.fn().mockResolvedValue(makeUpload({
          status: UploadStatus.ABANDONED,
        })),
      },
    });

    const result = await service.getPlayback(undefined, "lesson_1", undefined);

    expect(result.ready).toBe(false);
    expect(result.hlsUrl).toBeNull();
  });
});
