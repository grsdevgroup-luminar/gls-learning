import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { EnrollmentModule } from "../enrollment/enrollment.module";
import { STREAM_CLEANUP_QUEUE } from "../jobs/jobs.constants";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { MediaRepository } from "./media.repository";
import { StreamCleanupService } from "./stream-cleanup.service";
import { StreamWebhookController } from "./stream-webhook.controller";
import { UploadRepository } from "./upload.repository";

@Module({
  imports: [
    EnrollmentModule,
    BullModule.registerQueue({ name: STREAM_CLEANUP_QUEUE }),
  ],
  controllers: [MediaController, StreamWebhookController],
  providers: [
    MediaService,
    MediaRepository,
    UploadRepository,
    StreamCleanupService,
  ],
  exports: [MediaService, StreamCleanupService],
})
export class MediaModule {}
