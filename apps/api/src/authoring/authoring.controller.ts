import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  courseStatusSchema,
  createCourseSchema,
  createQuizQuestionSchema,
  createQuizSchema,
  lessonSchema,
  reorderSchema,
  sectionSchema,
  updateCourseSchema,
  updateQuizQuestionSchema,
  updateQuizSchema,
  type CourseStatusInput,
  type CreateCourseInput,
  type CreateQuizInput,
  type CreateQuizQuestionInput,
  type LessonInput,
  type ReorderInput,
  type SectionInput,
  type UpdateCourseInput,
  type UpdateQuizInput,
  type UpdateQuizQuestionInput,
} from "@skillstream/shared";
import { CurrentUser, Roles, type RequestUser } from "../common/decorators";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthoringService } from "./authoring.service";

@ApiTags("authoring")
@ApiBearerAuth()
@Roles("INSTRUCTOR", "ADMIN")
@Controller()
export class AuthoringController {
  constructor(private readonly authoring: AuthoringService) {}

  @Get("me/instructor/courses")
  myCourses(@CurrentUser() user: RequestUser) {
    return this.authoring.myCourses(user);
  }

  /** Owner/admin course detail — includes drafts, which the public catalog hides. */
  @Get("authoring/courses/:id")
  authoringDetail(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.authoring.ownerDetail(user, id);
  }

  /** Owner/admin quiz content (with answers) for the builder. */
  @Get("authoring/lessons/:lessonId/quiz")
  authoringQuiz(
    @CurrentUser() user: RequestUser,
    @Param("lessonId") lessonId: string,
  ) {
    return this.authoring.ownerQuiz(user, lessonId);
  }

  @Post("courses")
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createCourseSchema)) body: CreateCourseInput,
  ) {
    return this.authoring.create(user, body);
  }

  @Patch("courses/:id")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCourseSchema)) body: UpdateCourseInput,
  ) {
    return this.authoring.update(user, id, body);
  }

  @Patch("courses/:id/status")
  setStatus(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(courseStatusSchema)) body: CourseStatusInput,
  ) {
    return this.authoring.setStatus(user, id, body);
  }

  @Delete("courses/:id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.authoring.remove(user, id);
  }

  // sections
  @Post("courses/:courseId/sections")
  addSection(
    @CurrentUser() user: RequestUser,
    @Param("courseId") courseId: string,
    @Body(new ZodValidationPipe(sectionSchema)) body: SectionInput,
  ) {
    return this.authoring.addSection(user, courseId, body);
  }

  @Patch("sections/:id")
  updateSection(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(sectionSchema)) body: SectionInput,
  ) {
    return this.authoring.updateSection(user, id, body);
  }

  @Delete("sections/:id")
  removeSection(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.authoring.removeSection(user, id);
  }

  @Post("courses/:courseId/sections/reorder")
  reorderSections(
    @CurrentUser() user: RequestUser,
    @Param("courseId") courseId: string,
    @Body(new ZodValidationPipe(reorderSchema)) body: ReorderInput,
  ) {
    return this.authoring.reorderSections(user, courseId, body.ids);
  }

  // lessons
  @Post("sections/:sectionId/lessons")
  addLesson(
    @CurrentUser() user: RequestUser,
    @Param("sectionId") sectionId: string,
    @Body(new ZodValidationPipe(lessonSchema)) body: LessonInput,
  ) {
    return this.authoring.addLesson(user, sectionId, body);
  }

  @Patch("lessons/:id")
  updateLesson(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(lessonSchema)) body: LessonInput,
  ) {
    return this.authoring.updateLesson(user, id, body);
  }

  @Delete("lessons/:id")
  removeLesson(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.authoring.removeLesson(user, id);
  }

  @Post("sections/:sectionId/lessons/reorder")
  reorderLessons(
    @CurrentUser() user: RequestUser,
    @Param("sectionId") sectionId: string,
    @Body(new ZodValidationPipe(reorderSchema)) body: ReorderInput,
  ) {
    return this.authoring.reorderLessons(user, sectionId, body.ids);
  }

  // ── quiz authoring ───────────────────────────────────────────────────────

  @Post("lessons/:lessonId/quiz")
  createQuiz(
    @CurrentUser() user: RequestUser,
    @Param("lessonId") lessonId: string,
    @Body(new ZodValidationPipe(createQuizSchema)) body: CreateQuizInput,
  ) {
    return this.authoring.createQuiz(user, lessonId, body);
  }

  @Patch("quizzes/:quizId")
  updateQuiz(
    @CurrentUser() user: RequestUser,
    @Param("quizId") quizId: string,
    @Body(new ZodValidationPipe(updateQuizSchema)) body: UpdateQuizInput,
  ) {
    return this.authoring.updateQuiz(user, quizId, body);
  }

  @Delete("quizzes/:quizId")
  deleteQuiz(
    @CurrentUser() user: RequestUser,
    @Param("quizId") quizId: string,
  ) {
    return this.authoring.deleteQuiz(user, quizId);
  }

  @Post("quizzes/:quizId/questions")
  addQuestion(
    @CurrentUser() user: RequestUser,
    @Param("quizId") quizId: string,
    @Body(new ZodValidationPipe(createQuizQuestionSchema)) body: CreateQuizQuestionInput,
  ) {
    return this.authoring.addQuestion(user, quizId, body);
  }

  @Patch("quiz-questions/:questionId")
  updateQuestion(
    @CurrentUser() user: RequestUser,
    @Param("questionId") questionId: string,
    @Body(new ZodValidationPipe(updateQuizQuestionSchema)) body: UpdateQuizQuestionInput,
  ) {
    return this.authoring.updateQuestion(user, questionId, body);
  }

  @Delete("quiz-questions/:questionId")
  deleteQuestion(
    @CurrentUser() user: RequestUser,
    @Param("questionId") questionId: string,
  ) {
    return this.authoring.deleteQuestion(user, questionId);
  }

  @Post("quizzes/:quizId/questions/reorder")
  reorderQuestions(
    @CurrentUser() user: RequestUser,
    @Param("quizId") quizId: string,
    @Body(new ZodValidationPipe(reorderSchema)) body: ReorderInput,
  ) {
    return this.authoring.reorderQuestions(user, quizId, body.ids);
  }
}
