import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";
import {
  adminInstructorApplicationQuerySchema,
  adminInstructorQuerySchema,
  nameChangeRequestQuerySchema,
  requestInstructorNameChangeSchema,
  applyInstructorSchema,
  rejectApplicationSchema,
  reviewApplicationSchema,
  updateInstructorProfileSchema,
  type AdminInstructorApplicationQuery,
  type AdminInstructorQuery,
  type NameChangeRequestQuery,
  type RequestInstructorNameChangeInput,
  type ApplyInstructorInput,
  type RejectApplicationInput,
  type ReviewApplicationInput,
  type UpdateInstructorProfileInput,
} from "@skillstream/shared";
import { CurrentUser, Public, Roles, type RequestUser } from "../../common/decorators/decorators";
import { ZodBody, ZodQuery } from "../../common/utils/swagger";
import { CV_MAX_BYTES } from "../storage/storage.constants";
import { InstructorService } from "./instructor.service";
import { CvFilePipe, type ValidatedCvFile } from "./pipes/cv-file.pipe";

@ApiTags("instructor")
@ApiBearerAuth()
@Controller()
export class InstructorController {
  constructor(private readonly instructor: InstructorService) {}

  @Post("instructors/apply")
  apply(
    @CurrentUser() user: RequestUser,
    @ZodBody(applyInstructorSchema) body: ApplyInstructorInput,
  ) {
    return this.instructor.apply(user, body);
  }

  @Post("instructors/apply/cv")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: CV_MAX_BYTES },
    }),
  )
  uploadCv(
    @CurrentUser() user: RequestUser,
    @UploadedFile(CvFilePipe) file: ValidatedCvFile,
  ) {
    return this.instructor.uploadCv(user, file);
  }

  @Delete("instructors/apply/cv")
  deleteCv(@CurrentUser() user: RequestUser, @Query("key") key?: string) {
    if (!key) throw new BadRequestException("key is required");
    return this.instructor.deleteCv(user, key);
  }

  @Public()
  @Get("instructors")
  roster() {
    return this.instructor.roster();
  }

  @Public()
  @Get("instructors/:id")
  publicProfile(@Param("id") id: string) {
    return this.instructor.publicProfile(id);
  }

  @Get("me/instructor")
  myProfile(@CurrentUser() user: RequestUser) {
    return this.instructor.myProfile(user);
  }

  @Patch("me/instructor")
  updateProfile(
    @CurrentUser() user: RequestUser,
    @ZodBody(updateInstructorProfileSchema)
    body: UpdateInstructorProfileInput,
  ) {
    return this.instructor.updateProfile(user, body);
  }

  @Post("me/instructor/name-change-requests")
  requestNameChange(
    @CurrentUser() user: RequestUser,
    @ZodBody(requestInstructorNameChangeSchema) body: RequestInstructorNameChangeInput,
  ) {
    return this.instructor.requestNameChange(user, body);
  }
  // ── admin ──
  @Roles("ADMIN")
  @Get("admin/instructor-name-change-requests")
  listNameChangeRequests(
    @ZodQuery(nameChangeRequestQuerySchema) query: NameChangeRequestQuery,
  ) {
    return this.instructor.listNameChangeRequests(query);
  }

  @Roles("ADMIN")
  @Post("admin/instructor-name-change-requests/:id/approve")
  approveNameChange(@CurrentUser() admin: RequestUser, @Param("id") id: string) {
    return this.instructor.approveNameChange(admin, id);
  }

  @Roles("ADMIN")
  @Post("admin/instructor-name-change-requests/:id/reject")
  rejectNameChange(
    @Param("id") id: string,
    @ZodBody(rejectApplicationSchema) body: RejectApplicationInput,
  ) {
    return this.instructor.rejectNameChange(id, body.note);
  }
  @Roles("ADMIN")
  @Get("admin/instructor-applications")
  listApplications(
    @ZodQuery(adminInstructorApplicationQuerySchema)
    query: AdminInstructorApplicationQuery,
  ) {
    return this.instructor.listApplications(query);
  }

  @Roles("ADMIN")
  @Get("admin/instructor-applications/stats")
  applicationStats() {
    return this.instructor.applicationStats();
  }

  @Roles("ADMIN")
  @Get("admin/instructors")
  adminRoster(
    @ZodQuery(adminInstructorQuerySchema) query: AdminInstructorQuery,
  ) {
    return this.instructor.adminRoster(query);
  }

  @Roles("ADMIN")
  @Post("admin/instructor-applications/:id/approve")
  approve(
    @Param("id") id: string,
    @ZodBody(reviewApplicationSchema)
    body: ReviewApplicationInput,
  ) {
    return this.instructor.approve(id, body.note);
  }

  @Roles("ADMIN")
  @Post("admin/instructor-applications/:id/reject")
  reject(
    @Param("id") id: string,
    @ZodBody(rejectApplicationSchema)
    body: RejectApplicationInput,
  ) {
    return this.instructor.reject(id, body.note);
  }
}
