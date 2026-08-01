import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export const reviewInclude = {
  user: { select: { name: true, avatar: true } },
  course: { select: { title: true } },
} satisfies Prisma.ReviewInclude;

export type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

@Injectable()
export class ReviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyAndCountForCourse(
    courseId: string,
    page: { page: number; pageSize: number },
  ) {
    const where: Prisma.ReviewWhereInput = { courseId, status: "APPROVED" };
    return this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        include: reviewInclude,
        orderBy: { createdAt: "desc" },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.prisma.review.count({ where }),
    ]);
  }

  findFeatured(limit: number) {
    return this.prisma.review.findMany({
      where: { status: "APPROVED", rating: { gte: 4 }, body: { not: "" } },
      include: reviewInclude,
      orderBy: [{ helpful: "desc" }, { createdAt: "desc" }],
      take: limit,
    });
  }

  findByCourseAndUser(userId: string, courseId: string) {
    return this.prisma.review.findUnique({
      where: { courseId_userId: { courseId, userId } },
      include: reviewInclude,
    });
  }

  upsertReview(
    userId: string,
    courseId: string,
    input: { rating: number; title: string; body: string },
  ) {
    return this.prisma.review.upsert({
      where: { courseId_userId: { courseId, userId } },
      update: { ...input, status: "PENDING" },
      create: { courseId, userId, ...input, status: "PENDING" },
      include: reviewInclude,
    });
  }

  findCourseTitle(courseId: string) {
    return this.prisma.course.findUnique({
      where: { id: courseId },
      select: { title: true },
    });
  }

  findManyForAdmin(status?: Prisma.ReviewWhereInput["status"]) {
    return this.prisma.review.findMany({
      where: status ? { status } : undefined,
      include: reviewInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  updateStatus(reviewId: string, status: Prisma.ReviewUpdateInput["status"]) {
    return this.prisma.review.update({
      where: { id: reviewId },
      data: { status },
      include: reviewInclude,
    });
  }

  aggregateApprovedForCourse(courseId: string) {
    return this.prisma.review.aggregate({
      where: { courseId, status: "APPROVED" },
      _avg: { rating: true },
      _count: true,
    });
  }

  updateCourseRating(courseId: string, ratingAvg: number, reviewCount: number) {
    return this.prisma.course.update({
      where: { id: courseId },
      data: {
        ratingAvg,
        reviewCount,
      },
    });
  }
}
