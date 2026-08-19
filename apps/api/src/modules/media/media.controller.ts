import { Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentUser, Public, Roles, type RequestUser } from "../../common/decorators/decorators";
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
    // TEMPORARY: diagnosing why Railway's edge doesn't surface the real
    // client IP in X-Forwarded-For (see clientIp() above). Reflects only the
    // caller's own request headers back to them — remove once resolved.
    if (req.query.ipdebug === "1") {
      return {
        xForwardedFor: req.headers["x-forwarded-for"] ?? null,
        xRealIp: req.headers["x-real-ip"] ?? null,
        xEnvoyExternalAddress: req.headers["x-envoy-external-address"] ?? null,
        cfConnectingIp: req.headers["cf-connecting-ip"] ?? null,
        trueClientIp: req.headers["true-client-ip"] ?? null,
        reqIp: req.ip,
        remoteAddress: req.socket?.remoteAddress ?? null,
        allHeaders: req.headers,
      };
    }
    return this.media.getPlayback(user?.id, lessonId, clientIp(req));
  }
}
