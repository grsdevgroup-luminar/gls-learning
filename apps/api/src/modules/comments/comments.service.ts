import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CommentDto,
  CreateCommentInput,
  Paginated,
  PaginationQuery,
} from "@skillstream/shared";
import { CommentsRepository, type CommentRow } from "./comments.repository";

@Injectable()
export class CommentsService {
  constructor(private readonly repo: CommentsRepository) {}

  private toDto(c: CommentRow): CommentDto {
    return {
      id: c.id,
      courseId: c.courseId,
      author: c.user.name,
      avatar: c.user.avatar,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      parentId: c.parentId,
      replies: c.replies.map((reply) => ({
        id: reply.id,
        courseId: reply.courseId,
        author: reply.user.name,
        avatar: reply.user.avatar,
        body: reply.body,
        createdAt: reply.createdAt.toISOString(),
        parentId: reply.parentId,
      })),
    };
  }

  /** 404s on an unknown course rather than letting a foreign-key violation
   *  surface as a 500, and keeps an empty list distinguishable from a typo. */
  private async assertCourseExists(courseId: string): Promise<void> {
    const course = await this.repo.findCourseId(courseId);
    if (!course) throw new NotFoundException("Course not found");
  }

  async listForCourse(
    courseId: string,
    page: PaginationQuery,
  ): Promise<Paginated<CommentDto>> {
    await this.assertCourseExists(courseId);
    const [rows, total] = await this.repo.listAndCountByCourse(
      courseId,
      (page.page - 1) * page.pageSize,
      page.pageSize,
    );
    return {
      items: rows.map((c) => this.toDto(c)),
      page: page.page,
      pageSize: page.pageSize,
      total,
      totalPages: Math.ceil(total / page.pageSize),
    };
  }

  async create(
    userId: string,
    courseId: string,
    input: CreateCommentInput,
  ): Promise<CommentDto> {
    await this.assertCourseExists(courseId);
    if (input.parentId) {
      const parent = await this.repo.findCommentParent(input.parentId);
      if (!parent || parent.courseId !== courseId || parent.parentId !== null) {
        throw new BadRequestException("Replies must target an existing top-level comment in this course");
      }
    }
    const comment = await this.repo.createComment(userId, courseId, input.body, input.parentId);
    return this.toDto(comment);
  }
}
