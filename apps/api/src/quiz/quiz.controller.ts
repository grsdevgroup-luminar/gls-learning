import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { quizAttemptSchema, type QuizAttemptInput } from "@skillstream/shared";
import { CurrentUser, type RequestUser } from "../common/decorators";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
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
    return this.quiz.getForPlay(user.id, lessonId);
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
    @Body(new ZodValidationPipe(quizAttemptSchema)) body: QuizAttemptInput,
  ) {
    return this.quiz.submitAttempt(user.id, lessonId, body);
  }
}
