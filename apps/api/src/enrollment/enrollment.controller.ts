import { Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, type RequestUser } from "../common/decorators";
import { EnrollmentService } from "./enrollment.service";

@ApiTags("enrollment")
@ApiBearerAuth()
@Controller()
export class EnrollmentController {
  constructor(private readonly enrollment: EnrollmentService) {}

  @Get("me/enrollments")
  myEnrollments(@CurrentUser() user: RequestUser) {
    return this.enrollment.myEnrollments(user.id);
  }

  @Get("me/certificates")
  myCertificates(@CurrentUser() user: RequestUser) {
    return this.enrollment.myCertificates(user.id);
  }

  @Get("me/courses/:courseId/progress")
  progress(
    @CurrentUser() user: RequestUser,
    @Param("courseId") courseId: string,
  ) {
    return this.enrollment.getOne(user.id, courseId);
  }

  @Post("courses/:courseId/enroll")
  enrollFree(
    @CurrentUser() user: RequestUser,
    @Param("courseId") courseId: string,
  ) {
    return this.enrollment.enrollFree(user.id, courseId);
  }

  @Post("enrollments/:courseId/lessons/:lessonId/toggle")
  toggleLesson(
    @CurrentUser() user: RequestUser,
    @Param("courseId") courseId: string,
    @Param("lessonId") lessonId: string,
  ) {
    return this.enrollment.toggleLesson(user.id, courseId, lessonId);
  }
}
