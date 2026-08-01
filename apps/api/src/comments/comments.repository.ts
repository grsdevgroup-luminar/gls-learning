import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export const COMMENT_INCLUDE = {
  user: { select: { name: true, avatar: true } },
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
    const where: Prisma.CommentWhereInput = { courseId };
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

  createComment(userId: string, courseId: string, body: string) {
    return this.prisma.comment.create({
      data: { courseId, userId, body },
      include: COMMENT_INCLUDE,
    });
  }
}
