import { BadRequestException, Injectable } from "@nestjs/common";
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
    input: { rating: number; body: string; progressPercent: number; ratingStage: "STARTED" | "IN_PROGRESS" | "COMPLETED"; ratingWeight: number },
  ) {
    return this.prisma.review.upsert({
      where: { courseId_userId: { courseId, userId } },
      update: { ...input, status: "PENDING" },
      // Keep the legacy database column populated without exposing it as a user field.
      create: { courseId, userId, title: "", ...input, status: "PENDING" },
      include: reviewInclude,
    });
  }

  findCourseTitle(courseId: string) {
    return this.prisma.course.findUnique({
      where: { id: courseId },
      select: { title: true, instructorId: true },
    });
  }

  findManyAndCountForAdmin(
    where: Prisma.ReviewWhereInput,
    page: { page: number; pageSize: number },
  ) {
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

  adminStats() {
    return this.prisma.$transaction([
      this.prisma.review.findMany({
        where: { status: "APPROVED" },
        select: { rating: true, ratingWeight: true },
      }),
      this.prisma.review.count({ where: { status: "PENDING" } }),
    ]);
  }
  findDistinctCourses() {
    return this.prisma.review.findMany({
      distinct: ["courseId"],
      select: {
        courseId: true,
        course: { select: { title: true } },
      },
    });
  }

  async updateStatus(reviewId: string, action: "APPROVE" | "HIDE" | "UNHIDE") {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.review.findUnique({
        where: { id: reviewId },
        select: { status: true, statusBeforeHidden: true },
      });

      if (!current) {
        // Preserve Prisma's normal not-found behavior and error shape.
        return tx.review.update({
          where: { id: reviewId },
          data: { status: action === "HIDE" ? "HIDDEN" : "APPROVED" },
          include: reviewInclude,
        });
      }

      if (action === "UNHIDE" && current.status !== "HIDDEN") {
        throw new BadRequestException("Only hidden reviews can be unhidden");
      }

      const isUnhiding = action === "UNHIDE" && current.status === "HIDDEN";
      const restoredStatus = current.statusBeforeHidden ?? "PENDING";

      return tx.review.update({
        where: { id: reviewId },
        data: isUnhiding
          ? { status: restoredStatus, statusBeforeHidden: null }
          : action === "HIDE"
            ? {
                status: "HIDDEN",
                // Do not overwrite the original status if this is already hidden.
                statusBeforeHidden: current.status === "HIDDEN" ? current.statusBeforeHidden : current.status,
              }
            : { status: "APPROVED", statusBeforeHidden: null },
        include: reviewInclude,
      });
    });
  }

  aggregateApprovedForCourse(courseId: string) {
    return this.prisma.review.findMany({
      where: { courseId, status: "APPROVED" },
      select: { rating: true, ratingWeight: true, ratingStage: true },
    });
  }

  updateCourseRating(courseId: string, ratingAvg: number, reviewCount: number, ratingWeightedCount: number, completedReviewCount: number) {
    return this.prisma.course.update({
      where: { id: courseId },
      data: {
        ratingAvg,
        reviewCount,
        ratingWeightedCount,
        completedReviewCount,
      },
    });
  }
}
