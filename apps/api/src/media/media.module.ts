import { Module } from "@nestjs/common";
import { EnrollmentModule } from "../enrollment/enrollment.module";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { MediaRepository } from "./media.repository";

@Module({
  imports: [EnrollmentModule],
  controllers: [MediaController],
  providers: [MediaService, MediaRepository],
})
export class MediaModule {}
