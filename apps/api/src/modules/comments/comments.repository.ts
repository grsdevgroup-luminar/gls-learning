import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export const COMMENT_INCLUDE = {
  user: { select: { name: true, avatar: true } },
  replies: {
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, avatar: true } } },
  },
} satisfies Prisma.CommentInclude;

export type CommentRow = Prisma.CommentGetPayload<{
  include: typeof COMMENT_INCLUDE;
}>;

@Injectable()
export class CommentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCourseId(courseId: string) {
    return this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
  }

  listAndCountByCourse(
    courseId: string,
    skip: number,
    take: number,
  ) {
    const where: Prisma.CommentWhereInput = { courseId, parentId: null };
    return this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        include: COMMENT_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.comment.count({ where }),
    ]);
  }

  findCommentParent(parentId: string) {
    return this.prisma.comment.findUnique({
      where: { id: parentId },
      select: { id: true, courseId: true, parentId: true },
    });
  }

  createComment(userId: string, courseId: string, body: string, parentId?: string) {
    return this.prisma.comment.create({
      data: { courseId, userId, body, parentId },
      include: COMMENT_INCLUDE,
    });
  }
}
