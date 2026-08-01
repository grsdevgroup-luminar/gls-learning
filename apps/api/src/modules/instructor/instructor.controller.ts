import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { InstructorStatus } from "@prisma/client";
import {
  applyInstructorSchema,
  reviewApplicationSchema,
  updateInstructorProfileSchema,
  type ApplyInstructorInput,
  type ReviewApplicationInput,
  type UpdateInstructorProfileInput,
} from "@skillstream/shared";
import { CurrentUser, Public, Roles, type RequestUser } from "../../common/decorators/decorators";
import { ZodBody } from "../../common/utils/swagger";
import { InstructorService } from "./instructor.service";

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

  @Public()
  @Get("instructors")
  roster() {
    return this.instructor.roster();
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

  // ── admin ──
  @Roles("ADMIN")
  @Get("admin/instructor-applications")
  listApplications(@Query("status") status?: InstructorStatus) {
    return this.instructor.listApplications(status);
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
    @ZodBody(reviewApplicationSchema)
    body: ReviewApplicationInput,
  ) {
    return this.instructor.reject(id, body.note);
  }
}
