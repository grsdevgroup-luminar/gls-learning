import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { courseListQuerySchema, type CourseListQuery } from "@skillstream/shared";
import { CurrentUser, Public, type RequestUser } from "../../common/decorators/decorators";
import { ZodQuery } from "../../common/utils/swagger";
import { CoursesService } from "./courses.service";
import { UsersService } from "../users/users.service";

@ApiTags("catalog")
@Controller()
export class CatalogController {
  constructor(
    private readonly courses: CoursesService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Get("courses")
  list(
    @ZodQuery(courseListQuerySchema) query: CourseListQuery,
  ) {
    return this.courses.list(query);
  }

  @Get("me/recommendations")
  async recommendations(
    @CurrentUser() user: RequestUser,
    @Query("limit") limit?: string,
  ) {
    const preferences = await this.users.learningPreferences(user.id);
    return this.courses.recommendedFor(user.id, preferences.categories, Number(limit) || 8);
  }

  @Public()
  @Get("courses/:slug")
  bySlug(@Param("slug") slug: string) {
    return this.courses.bySlug(slug);
  }

  @Get("me/courses/:courseId/learning")
  learning(
    @CurrentUser() user: RequestUser,
    @Param("courseId") courseId: string,
  ) {
    return this.courses.learning(user.id, courseId);
  }
}
