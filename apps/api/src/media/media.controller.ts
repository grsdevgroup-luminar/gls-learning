import { Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, Roles, type RequestUser } from "../common/decorators";
import { MediaService } from "./media.service";

@ApiTags("media")
@ApiBearerAuth()
@Controller()
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Roles("INSTRUCTOR", "ADMIN")
  @Post("media/upload-url")
  createUploadUrl() {
    return this.media.createDirectUpload();
  }

  @Get("lessons/:lessonId/playback")
  playback(
    @CurrentUser() user: RequestUser,
    @Param("lessonId") lessonId: string,
  ) {
    return this.media.getPlayback(user.id, lessonId);
  }
}
