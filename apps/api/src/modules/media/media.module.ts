import { Module } from "@nestjs/common";
import { EnrollmentModule } from "../enrollment/enrollment.module";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { MediaRepository } from "./media.repository";
import { UploadRepository } from "./upload.repository";

@Module({
  imports: [EnrollmentModule],
  controllers: [MediaController],
  providers: [MediaService, MediaRepository, UploadRepository],
  exports: [MediaService],
})
export class MediaModule {}
