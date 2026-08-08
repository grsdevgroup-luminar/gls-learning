import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { courseListQuerySchema, type CourseListQuery } from "@skillstream/shared";
import { Public } from "../../common/decorators/decorators";
import { ZodQuery } from "../../common/utils/swagger";
import { CoursesService } from "./courses.service";

@ApiTags("catalog")
@Controller()
export class CatalogController {
  constructor(private readonly courses: CoursesService) {}

  @Public()
  @Get("courses")
  list(
    @ZodQuery(courseListQuerySchema) query: CourseListQuery,
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
