import { Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, Public, Roles, type RequestUser } from "../common/decorators";
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

  // Public so storefront "free preview" lessons play for logged-out visitors;
  // non-preview lessons still require enrollment, checked in the service.
  @Public()
  @Get("lessons/:lessonId/playback")
  playback(
    @CurrentUser() user: RequestUser | undefined,
    @Param("lessonId") lessonId: string,
  ) {
    return this.media.getPlayback(user?.id, lessonId);
  }
}
