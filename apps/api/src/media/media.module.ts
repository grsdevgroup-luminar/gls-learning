import { Module } from "@nestjs/common";
import { EnrollmentModule } from "../enrollment/enrollment.module";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";

@Module({
  imports: [EnrollmentModule],
  controllers: [MediaController],
  providers: [MediaService],
})
export class MediaModule {}
