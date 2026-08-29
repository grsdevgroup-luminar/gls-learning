import { describe, it, expect, vi, beforeEach } from "vitest";
import { UploadStatus } from "@prisma/client";
import type { ConfigService } from "@nestjs/config";
import type { Queue } from "bullmq";
import type { Env } from "../../../config/env";
import { StreamCleanupService } from "../stream-cleanup.service";
import type { UploadRepository } from "../upload.repository";

function makeService(overrides: {
  uploads?: Partial<UploadRepository>;
  queue?: Partial<Queue>;
}) {
  const queue = {
    add: vi.fn().mockResolvedValue(undefined),
    ...overrides.queue,
  } as unknown as Queue;

  const uploads = {
    countLessonsByCfVideoUid: vi.fn().mockResolvedValue(0),
    findExpiredCreated: vi.fn().mockResolvedValue([]),
    findStaleUploading: vi.fn().mockResolvedValue([]),
    findAbandonedWithCloudflareUid: vi.fn().mockResolvedValue([]),
    findUnattachedFailedBefore: vi.fn().mockResolvedValue([]),
    markAbandonedIfCreated: vi.fn().mockResolvedValue({ count: 1 }),
    markAbandonedIfUploading: vi.fn().mockResolvedValue({ count: 1 }),
    ...overrides.uploads,
  } as unknown as UploadRepository;

  const config = {
    get: vi.fn((key: keyof Env) => {
      if (key === "STREAM_STALE_UPLOADING_HOURS") return 48;
      if (key === "STREAM_FAILED_RETENTION_DAYS") return 7;
      return undefined;
    }),
  } as unknown as ConfigService<Env, true>;

  return {
    service: new StreamCleanupService(queue, uploads, config),
    queue,
    uploads,
  };
}

describe("StreamCleanupService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not enqueue CF delete when a lesson still references the UID", async () => {
    const { service, queue, uploads } = makeService({
      uploads: { countLessonsByCfVideoUid: vi.fn().mockResolvedValue(1) },
    });

    await service.maybeEnqueueCloudflareDeleteIfUnreferenced("cf_vid_1");

    expect(uploads.countLessonsByCfVideoUid).toHaveBeenCalledWith("cf_vid_1");
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("enqueues a deduped CF delete when the UID is unreferenced", async () => {
    const { service, queue } = makeService({});

    await service.maybeEnqueueCloudflareDeleteIfUnreferenced("cf_vid_1");

    expect(queue.add).toHaveBeenCalledWith(
      "delete-cf-video",
      { cloudflareUid: "cf_vid_1" },
      expect.objectContaining({
        jobId: "cf-delete-cf_vid_1",
        removeOnComplete: true,
        removeOnFail: true,
      }),
    );
  });

  it("marks expired CREATED uploads abandoned and queues CF delete", async () => {
    const { service, queue, uploads } = makeService({
      uploads: {
        findExpiredCreated: vi.fn().mockResolvedValue([
          { id: "upload_1", cloudflareUid: "cf_vid_1" },
        ]),
      },
    });

    const result = await service.runMaintenanceSweep();

    expect(uploads.markAbandonedIfCreated).toHaveBeenCalledWith("upload_1");
    expect(queue.add).toHaveBeenCalledWith(
      "delete-cf-video",
      { cloudflareUid: "cf_vid_1" },
      expect.any(Object),
    );
    expect(result.expiredCreated).toBe(1);
  });

  it("skips abandoned deletes still referenced by a lesson", async () => {
    const { service, queue, uploads } = makeService({
      uploads: {
        findAbandonedWithCloudflareUid: vi.fn().mockResolvedValue([
          { id: "upload_1", cloudflareUid: "cf_vid_1" },
        ]),
        countLessonsByCfVideoUid: vi.fn().mockResolvedValue(1),
      },
    });

    const result = await service.runMaintenanceSweep();

    expect(queue.add).not.toHaveBeenCalled();
    expect(result.abandonedDeletes).toBe(0);
  });

  it("does not delete uploads that completed before the sweep marks them abandoned", async () => {
    const { service, queue, uploads } = makeService({
      uploads: {
        findExpiredCreated: vi.fn().mockResolvedValue([
          { id: "upload_1", cloudflareUid: "cf_vid_1" },
        ]),
        markAbandonedIfCreated: vi.fn().mockResolvedValue({ count: 0 }),
      },
    });

    const result = await service.runMaintenanceSweep();

    expect(queue.add).not.toHaveBeenCalled();
    expect(result.expiredCreated).toBe(0);
  });

  it("purges unattached FAILED uploads after retention", async () => {
    const { service, queue } = makeService({
      uploads: {
        findUnattachedFailedBefore: vi.fn().mockResolvedValue([
          { id: "upload_2", cloudflareUid: "cf_vid_2" },
        ]),
      },
    });

    const result = await service.runMaintenanceSweep();

    expect(queue.add).toHaveBeenCalledWith(
      "delete-cf-video",
      { cloudflareUid: "cf_vid_2" },
      expect.any(Object),
    );
    expect(result.failedPurges).toBe(1);
  });
});
