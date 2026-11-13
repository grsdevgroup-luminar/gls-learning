import { Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { gradeWrittenAnswerSchema, quizAttemptSchema, type QuizAttemptInput, type GradeWrittenAnswerInput } from "@grslearning/shared";
import { CurrentUser, Roles, type RequestUser } from "../../common/decorators/decorators";
import { ZodBody } from "../../common/utils/swagger";
import { QuizService } from "./quiz.service";

@ApiTags("quiz")
@ApiBearerAuth()
@Controller("lessons/:lessonId/quiz")
export class QuizController {
  constructor(private readonly quiz: QuizService) {}

  @Get()
  getForPlay(
    @CurrentUser() user: RequestUser,
    @Param("lessonId") lessonId: string,
  ) {
    return this.quiz.getForPlay(user.id, lessonId, user.role);
  }

  @Get("result")
  getResult(
    @CurrentUser() user: RequestUser,
    @Param("lessonId") lessonId: string,
  ) {
    return this.quiz.getResult(user.id, lessonId);
  }

  @Post("attempt")
  submit(
    @CurrentUser() user: RequestUser,
    @Param("lessonId") lessonId: string,
    @ZodBody(quizAttemptSchema) body: QuizAttemptInput,
  ) {
    return this.quiz.submitAttempt(user.id, lessonId, body);
  }
}

@ApiTags("quiz-review")
@ApiBearerAuth()
@Roles("INSTRUCTOR", "ADMIN")
@Controller()
export class QuizReviewController {
  constructor(private readonly quiz: QuizService) {}

  @Get("instructor/courses/:courseId/quiz-submissions")
  list(@CurrentUser() user: RequestUser, @Param("courseId") courseId: string) {
    return this.quiz.listSubmissions(user, courseId);
  }

  @Get("instructor/quiz-submissions/:attemptId")
  detail(@CurrentUser() user: RequestUser, @Param("attemptId") attemptId: string) {
    return this.quiz.getSubmission(user, attemptId);
  }

  @Patch("instructor/quiz-submissions/:attemptId/answers/:answerId")
  grade(
    @CurrentUser() user: RequestUser,
    @Param("attemptId") attemptId: string,
    @Param("answerId") answerId: string,
    @ZodBody(gradeWrittenAnswerSchema) body: GradeWrittenAnswerInput,
  ) {
    return this.quiz.gradeWrittenAnswer(user, attemptId, answerId, body);
  }
}
