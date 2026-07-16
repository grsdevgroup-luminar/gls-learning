import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  createCommentSchema,
  paginationQuerySchema,
  type CreateCommentInput,
  type PaginationQuery,
} from "@skillstream/shared";
import { CurrentUser, Public, type RequestUser } from "../common/decorators";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CommentsService } from "./comments.service";

@ApiTags("comments")
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  /** Public read: the discussion is visible to anyone on the course page. */
  @Public()
  @Get("courses/:courseId/comments")
  list(
    @Param("courseId") courseId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) page: PaginationQuery,
  ) {
    return this.comments.listForCourse(courseId, page);
  }

  /** Writing only requires a session — no enrollment gate, no moderation. */
  @ApiBearerAuth()
  @Post("courses/:courseId/comments")
  create(
    @CurrentUser() user: RequestUser,
    @Param("courseId") courseId: string,
    @Body(new ZodValidationPipe(createCommentSchema)) body: CreateCommentInput,
  ) {
    return this.comments.create(user.id, courseId, body);
  }
}
