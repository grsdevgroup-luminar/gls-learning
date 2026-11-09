import { Controller, Delete, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";
import { CurrentUser, Roles, type RequestUser } from "../../common/decorators/decorators";
import { CourseResourceService } from "./course-resource.service";
import { ResourceFilePipe, type ValidatedResourceFile } from "./pipes/resource-file.pipe";

@ApiTags("authoring")
@ApiBearerAuth()
@Roles("INSTRUCTOR", "ADMIN")
@Controller("authoring/courses/:courseId/resources")
export class CourseResourceController {
  constructor(private readonly resources: CourseResourceService) {}

  @Post()
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: Number(process.env.STORAGE_MAX_BYTES) || 10 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentUser() user: RequestUser,
    @Param("courseId") courseId: string,
    @UploadedFile(ResourceFilePipe) file: ValidatedResourceFile,
  ) {
    return this.resources.upload(user, courseId, file);
  }

  @Delete(":resourceId")
  remove(
    @CurrentUser() user: RequestUser,
    @Param("courseId") courseId: string,
    @Param("resourceId") resourceId: string,
  ) {
    return this.resources.remove(user, courseId, resourceId);
  }
}
