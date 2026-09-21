import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";
import {
  CurrentUser,
  Roles,
  type RequestUser,
} from "../../common/decorators/decorators";
import type { Env } from "../../config/env";
import { LessonResourceService } from "./lesson-resource.service";
import {
  PptxFilePipe,
  ResourceFilePipe,
  type ValidatedResourceFile,
} from "./pipes/resource-file.pipe";

/**
 * Lesson resource upload endpoints. Kept in a dedicated controller because
 * multipart handling, size limits, and MIME validation have nothing to do
 * with the JSON-only routes on AuthoringController.
 */
@ApiTags("authoring")
@ApiBearerAuth()
@Roles("INSTRUCTOR", "ADMIN")
@Controller("authoring/lessons/:lessonId/resources")
export class LessonResourceController {
  constructor(
    private readonly resources: LessonResourceService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post()
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    // FileInterceptor doesn't read the DI container, so multer options are
    // resolved lazily. `STORAGE_MAX_BYTES` is validated at boot; a stale env
    // is impossible by the time this handler binds. Memory storage is fine
    // at 10 MB — a stream direct to S3/disk would help only for larger caps.
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: {
        // Read once at module init via a closure over process.env. Keeps the
        // multer error path (413) firing before the handler runs.
        fileSize:
          Number(process.env.STORAGE_MAX_BYTES) || 10 * 1024 * 1024,
      },
    }),
  )
  upload(
    @CurrentUser() user: RequestUser,
    @Param("lessonId") lessonId: string,
    @UploadedFile(ResourceFilePipe) file: ValidatedResourceFile,
  ) {
    return this.resources.upload(user, lessonId, file);
  }

  @Delete()
  remove(
    @CurrentUser() user: RequestUser,
    @Param("lessonId") lessonId: string,
    // The storage key contains slashes (`resources/{lessonId}/{ulid}.ext`)
    // which don't survive as a path param — a query string is the least ugly
    // option. Ownership check inside the service confirms the key actually
    // belongs to `lessonId`, so a caller can't pass someone else's key.
    @Query("storageKey") storageKey: string | undefined,
  ) {
    if (!storageKey) throw new BadRequestException("storageKey is required");
    return this.resources.remove(user, lessonId, storageKey);
  }
}


@ApiTags("authoring")
@ApiBearerAuth()
@Roles("INSTRUCTOR", "ADMIN")
@Controller("authoring/lessons/:lessonId/pptx")
export class LessonPptxController {
  constructor(private readonly resources: LessonResourceService) {}
  @Post()
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: Number(process.env.STORAGE_MAX_BYTES) || 10 * 1024 * 1024 } }))
  upload(@CurrentUser() user: RequestUser, @Param("lessonId") lessonId: string, @UploadedFile(PptxFilePipe) file: ValidatedResourceFile, @Body("durationSec") durationSec?: string) {
    const seconds = Math.max(0, Math.min(86400, Number(durationSec ?? 0) || 0));
    return this.resources.uploadPptx(user, lessonId, file, seconds);
  }
  @Delete()
  remove(@CurrentUser() user: RequestUser, @Param("lessonId") lessonId: string) {
    return this.resources.removePptx(user, lessonId);
  }
}
