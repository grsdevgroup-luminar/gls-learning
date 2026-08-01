import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  createReviewSchema,
  paginationQuerySchema,
  type CreateReviewInput,
  type PaginationQuery,
} from "@skillstream/shared";
import { CurrentUser, Public, type RequestUser } from "../../common/decorators/decorators";
import { ZodBody, ZodQuery } from "../../common/utils/swagger";
import { ReviewsService } from "./reviews.service";

@ApiTags("reviews")
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get("reviews/featured")
  featured() {
    return this.reviews.featured(6);
  }

  @Public()
  @Get("courses/:courseId/reviews")
  list(
    @Param("courseId") courseId: string,
    @ZodQuery(paginationQuerySchema) page: PaginationQuery,
  ) {
    return this.reviews.listForCourse(courseId, page);
  }

  @ApiBearerAuth()
  @Get("me/courses/:courseId/review")
  mine(
    @CurrentUser() user: RequestUser,
    @Param("courseId") courseId: string,
  ) {
    return this.reviews.myReview(user.id, courseId);
  }

  @ApiBearerAuth()
  @Post("courses/:courseId/reviews")
  create(
    @CurrentUser() user: RequestUser,
    @Param("courseId") courseId: string,
    @ZodBody(createReviewSchema) body: CreateReviewInput,
  ) {
    return this.reviews.create(user.id, courseId, body);
  }
}
