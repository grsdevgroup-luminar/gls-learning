import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  recordWatchTimeSchema,
  type RecordWatchTimeInput,
} from "@skillstream/shared";
import { CurrentUser, type RequestUser } from "../../common/decorators/decorators";
import { ZodBody } from "../../common/utils/swagger";
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

  @Get("me/activity")
  activity(
    @CurrentUser() user: RequestUser,
    @Query("period") period?: "daily" | "weekly" | "monthly",
  ) {
    return this.enrollment.activity(user.id, period);
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

  @Get("enrollments/:courseId/lessons/:lessonId/pptx-completion")
  pptxCompletion(@CurrentUser() user: RequestUser, @Param("courseId") courseId: string, @Param("lessonId") lessonId: string) {
    return this.enrollment.getPptxCompletion(user.id, courseId, lessonId);
  }

  @Post("enrollments/:courseId/lessons/:lessonId/pptx-completion")
  setPptxCompletion(@CurrentUser() user: RequestUser, @Param("courseId") courseId: string, @Param("lessonId") lessonId: string, @Body("completed") completed: boolean) {
    return this.enrollment.setPptxCompletion(user.id, courseId, lessonId, completed === true);
  }

  @Post("enrollments/:courseId/lessons/:lessonId/watch-time")
  recordWatchTime(
    @CurrentUser() user: RequestUser,
    @Param("courseId") courseId: string,
    @Param("lessonId") lessonId: string,
    @ZodBody(recordWatchTimeSchema) body: RecordWatchTimeInput,
  ) {
    return this.enrollment.recordWatchTime(user.id, courseId, lessonId, body.watchedSec);
  }
}
