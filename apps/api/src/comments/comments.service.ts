import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CommentDto,
  CreateCommentInput,
  Paginated,
  PaginationQuery,
} from "@skillstream/shared";
import { PrismaService } from "../prisma/prisma.service";

const commentInclude = {
  user: { select: { name: true, avatar: true } },
} satisfies Prisma.CommentInclude;
type CommentRow = Prisma.CommentGetPayload<{ include: typeof commentInclude }>;

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(c: CommentRow): CommentDto {
    return {
      id: c.id,
      courseId: c.courseId,
      author: c.user.name,
      avatar: c.user.avatar,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    };
  }

  /** 404s on an unknown course rather than letting a foreign-key violation
   *  surface as a 500, and keeps an empty list distinguishable from a typo. */
  private async assertCourseExists(courseId: string): Promise<void> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) throw new NotFoundException("Course not found");
  }

  async listForCourse(
    courseId: string,
    page: PaginationQuery,
  ): Promise<Paginated<CommentDto>> {
    await this.assertCourseExists(courseId);
    const where: Prisma.CommentWhereInput = { courseId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        include: commentInclude,
        orderBy: { createdAt: "desc" },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.prisma.comment.count({ where }),
    ]);
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
    const comment = await this.prisma.comment.create({
      data: { courseId, userId, body: input.body },
      include: commentInclude,
    });
    return this.toDto(comment);
  }
}
