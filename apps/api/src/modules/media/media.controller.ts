import { Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentUser, Public, Roles, type RequestUser } from "../../common/decorators/decorators";
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
  // Rate-limited per IP: 30/min is well above real lesson-switching pace but
  // blocks a script walking every lesson ID in a course to harvest tokens.
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get("lessons/:lessonId/playback")
  playback(
    @CurrentUser() user: RequestUser | undefined,
    @Param("lessonId") lessonId: string,
    @Req() req: Request,
  ) {
    return this.media.getPlayback(user?.id, lessonId, req.ip);
  }
}
