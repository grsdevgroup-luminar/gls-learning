import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { courseListQuerySchema, type CourseListQuery } from "@skillstream/shared";
import { Public } from "../common/decorators";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CoursesService } from "./courses.service";

@ApiTags("catalog")
@Controller()
export class CatalogController {
  constructor(private readonly courses: CoursesService) {}

  @Public()
  @Get("courses")
  list(
    @Query(new ZodValidationPipe(courseListQuerySchema)) query: CourseListQuery,
  ) {
    return this.courses.list(query);
  }

  @Public()
  @Get("categories")
  categories() {
    return this.courses.categories();
  }

  @Public()
  @Get("courses/:slug")
  bySlug(@Param("slug") slug: string) {
    return this.courses.bySlug(slug);
  }
}
