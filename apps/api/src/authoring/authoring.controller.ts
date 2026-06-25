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
  lessonSchema,
  reorderSchema,
  sectionSchema,
  updateCourseSchema,
  type CourseStatusInput,
  type CreateCourseInput,
  type LessonInput,
  type ReorderInput,
  type SectionInput,
  type UpdateCourseInput,
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
}
