import { Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  createCommentSchema,
  paginationQuerySchema,
  type CreateCommentInput,
  type PaginationQuery,
} from "@skillstream/shared";
import { CurrentUser, Public, type RequestUser } from "../../common/decorators/decorators";
import { ZodBody, ZodQuery } from "../../common/utils/swagger";
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
    @ZodQuery(paginationQuerySchema) page: PaginationQuery,
  ) {
    return this.comments.listForCourse(courseId, page);
  }

  /** Writing only requires a session — no enrollment gate, no moderation. */
  @ApiBearerAuth()
  @Post("courses/:courseId/comments")
  create(
    @CurrentUser() user: RequestUser,
    @Param("courseId") courseId: string,
    @ZodBody(createCommentSchema) body: CreateCommentInput,
  ) {
    return this.comments.create(user.id, courseId, body);
  }
}
