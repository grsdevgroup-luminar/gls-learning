import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  createReviewSchema,
  paginationQuerySchema,
  type CreateReviewInput,
  type PaginationQuery,
} from "@skillstream/shared";
import { CurrentUser, Public, type RequestUser } from "../common/decorators";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ReviewsService } from "./reviews.service";

@ApiTags("reviews")
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get("courses/:courseId/reviews")
  list(
    @Param("courseId") courseId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) page: PaginationQuery,
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
    @Body(new ZodValidationPipe(createReviewSchema)) body: CreateReviewInput,
  ) {
    return this.reviews.create(user.id, courseId, body);
  }
}
