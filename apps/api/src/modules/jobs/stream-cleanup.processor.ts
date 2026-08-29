import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job } from "bullmq";
import type { Env } from "../../config/env";
import { deleteCloudflareStreamVideo } from "../media/cloudflare-tus";
import type { StreamCleanupDeleteJob } from "../media/stream-cleanup.service";
import { STREAM_CLEANUP_QUEUE } from "./jobs.constants";

@Processor(STREAM_CLEANUP_QUEUE)
export class StreamCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(StreamCleanupProcessor.name);

  constructor(private readonly config: ConfigService<Env, true>) {
    super();
  }

  async process(job: Job<StreamCleanupDeleteJob>): Promise<{ ok: true }> {
    if (job.name !== "delete-cf-video") return { ok: true };

    const accountId = this.config.get("CLOUDFLARE_ACCOUNT_ID", { infer: true });
    const token = this.config.get("CLOUDFLARE_STREAM_TOKEN", { infer: true });
    if (!accountId || !token) {
      this.logger.warn(
        `Skipping CF delete for ${job.data.cloudflareUid} — Stream not configured`,
      );
      return { ok: true };
    }

    try {
      await deleteCloudflareStreamVideo(
        accountId,
        token,
        job.data.cloudflareUid,
      );
      this.logger.log(`Deleted Cloudflare Stream video ${job.data.cloudflareUid}`);
    } catch (err) {
      this.logger.warn(
        `CF delete failed for ${job.data.cloudflareUid}: ${(err as Error).message}`,
      );
      throw err;
    }

    return { ok: true };
  }
}
