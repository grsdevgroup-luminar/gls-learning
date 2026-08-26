import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import {
  createTusUploadSchema,
  type CreateTusUploadInput,
} from "@skillstream/shared";
import { CurrentUser, Public, Roles, type RequestUser } from "../../common/decorators/decorators";
import { ZodBody } from "../../common/utils/swagger";
import { MediaService } from "./media.service";

function clientIp(req: Request): string | undefined {
  const xff = req.headers["x-forwarded-for"];
  const first = Array.isArray(xff) ? xff[0] : xff?.split(",")[0];
  return first?.trim() || req.ip;
}

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

  @Roles("INSTRUCTOR", "ADMIN")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("media/tus")
  createTusUpload(
    @CurrentUser() user: RequestUser,
    @ZodBody(createTusUploadSchema) body: CreateTusUploadInput,
  ) {
    return this.media.createTusUpload(user, body);
  }

  @Roles("INSTRUCTOR", "ADMIN")
  @Post("media/uploads/:uploadId/complete")
  @HttpCode(200)
  completeUpload(
    @CurrentUser() user: RequestUser,
    @Param("uploadId") uploadId: string,
  ) {
    return this.media.completeUpload(user, uploadId);
  }

  @Roles("INSTRUCTOR", "ADMIN")
  @Get("media/uploads/:uploadId")
  getUploadStatus(
    @CurrentUser() user: RequestUser,
    @Param("uploadId") uploadId: string,
  ) {
    return this.media.getUploadStatus(user, uploadId);
  }

  @Roles("INSTRUCTOR", "ADMIN")
  @Delete("media/uploads/:uploadId")
  @HttpCode(204)
  async discardUpload(
    @CurrentUser() user: RequestUser,
    @Param("uploadId") uploadId: string,
  ): Promise<void> {
    await this.media.discardUpload(user, uploadId);
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
    return this.media.getPlayback(user?.id, lessonId, clientIp(req));
  }
}
