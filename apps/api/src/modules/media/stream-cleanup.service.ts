import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Queue } from "bullmq";
import type { Env } from "../../config/env";
import { STREAM_CLEANUP_QUEUE } from "../jobs/jobs.constants";
import { UploadRepository } from "./upload.repository";

export interface StreamCleanupSweepResult {
  expiredCreated: number;
  staleUploading: number;
  abandonedDeletes: number;
  failedPurges: number;
}

export interface StreamCleanupDeleteJob {
  cloudflareUid: string;
}

@Injectable()
export class StreamCleanupService {
  private readonly logger = new Logger(StreamCleanupService.name);

  constructor(
    @InjectQueue(STREAM_CLEANUP_QUEUE) private readonly queue: Queue,
    private readonly uploads: UploadRepository,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Queues a best-effort Cloudflare Stream delete (deduped while in-flight). */
  async enqueueCloudflareDelete(cloudflareUid: string): Promise<void> {
    try {
      await this.queue.add(
        "delete-cf-video",
        { cloudflareUid } satisfies StreamCleanupDeleteJob,
        {
          jobId: `cf-delete-${cloudflareUid}`,
          removeOnComplete: true,
          removeOnFail: true,
          attempts: 5,
          backoff: { type: "exponential", delay: 60_000 },
        },
      );
    } catch (err) {
      this.logger.warn(
        `Failed to enqueue CF delete for ${cloudflareUid}: ${(err as Error).message}`,
      );
    }
  }

  /** Deletes a CF video when no lesson row still references the UID. */
  async maybeEnqueueCloudflareDeleteIfUnreferenced(
    cloudflareUid: string,
  ): Promise<void> {
    const referenced = await this.uploads.countLessonsByCfVideoUid(cloudflareUid);
    if (referenced > 0) return;
    await this.enqueueCloudflareDelete(cloudflareUid);
  }

  /** Periodic sweep for expired, stale, and orphaned upload rows. */
  async runMaintenanceSweep(): Promise<StreamCleanupSweepResult> {
    const now = new Date();
    const staleUploadingBefore = new Date(
      now.getTime() -
        this.config.get("STREAM_STALE_UPLOADING_HOURS", { infer: true }) *
          3_600_000,
    );
    const failedRetentionBefore = new Date(
      now.getTime() -
        this.config.get("STREAM_FAILED_RETENTION_DAYS", { infer: true }) *
          86_400_000,
    );

    const result: StreamCleanupSweepResult = {
      expiredCreated: 0,
      staleUploading: 0,
      abandonedDeletes: 0,
      failedPurges: 0,
    };

    for (const row of await this.uploads.findExpiredCreated(now)) {
      const updated = await this.uploads.markAbandonedIfCreated(row.id);
      if (updated.count === 1 && row.cloudflareUid) {
        await this.enqueueCloudflareDelete(row.cloudflareUid);
        result.expiredCreated += 1;
      }
    }

    for (const row of await this.uploads.findStaleUploading(staleUploadingBefore)) {
      const updated = await this.uploads.markAbandonedIfUploading(row.id);
      if (updated.count === 1 && row.cloudflareUid) {
        await this.enqueueCloudflareDelete(row.cloudflareUid);
        result.staleUploading += 1;
      }
    }

    for (const row of await this.uploads.findAbandonedWithCloudflareUid()) {
      if (!row.cloudflareUid) continue;
      const referenced = await this.uploads.countLessonsByCfVideoUid(
        row.cloudflareUid,
      );
      if (referenced > 0) continue;
      await this.enqueueCloudflareDelete(row.cloudflareUid);
      result.abandonedDeletes += 1;
    }

    for (const row of await this.uploads.findUnattachedFailedBefore(
      failedRetentionBefore,
    )) {
      if (!row.cloudflareUid) continue;
      const referenced = await this.uploads.countLessonsByCfVideoUid(
        row.cloudflareUid,
      );
      if (referenced > 0) continue;
      await this.enqueueCloudflareDelete(row.cloudflareUid);
      result.failedPurges += 1;
    }

    this.logger.log(`upload maintenance sweep: ${JSON.stringify(result)}`);
    return result;
  }
}
