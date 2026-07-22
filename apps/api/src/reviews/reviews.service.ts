import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CreateReviewInput,
  Paginated,
  PaginationQuery,
  ReviewDto,
  ReviewStatusInput,
} from "@skillstream/shared";
import { PrismaService } from "../prisma/prisma.service";
import { EnrollmentService } from "../enrollment/enrollment.service";

const reviewInclude = {
  user: { select: { name: true, avatar: true } },
  course: { select: { title: true } },
} satisfies Prisma.ReviewInclude;
type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollment: EnrollmentService,
  ) {}

  private toDto(r: ReviewRow): ReviewDto {
    return {
      id: r.id,
      courseId: r.courseId,
      author: r.user.name,
      avatar: r.user.avatar,
      rating: r.rating,
      title: r.title,
      body: r.body,
      status: r.status,
      helpful: r.helpful,
      createdAt: r.createdAt.toISOString(),
      courseTitle: r.course.title,
    };
  }

  async listForCourse(
    courseId: string,
    page: PaginationQuery,
  ): Promise<Paginated<ReviewDto>> {
    const where: Prisma.ReviewWhereInput = { courseId, status: "APPROVED" };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        include: reviewInclude,
        orderBy: { createdAt: "desc" },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.prisma.review.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.toDto(r)),
      page: page.page,
      pageSize: page.pageSize,
      total,
      totalPages: Math.ceil(total / page.pageSize),
    };
  }

  /** Platform-wide highlights for marketing surfaces (landing page, etc.):
   * highly-rated, approved reviews with an actual write-up. */
  async featured(limit: number): Promise<ReviewDto[]> {
    const rows = await this.prisma.review.findMany({
      where: { status: "APPROVED", rating: { gte: 4 }, body: { not: "" } },
      include: reviewInclude,
      orderBy: [{ helpful: "desc" }, { createdAt: "desc" }],
      take: limit,
    });
    return rows.map((r) => this.toDto(r));
  }

  async myReview(userId: string, courseId: string): Promise<ReviewDto | null> {
    const r = await this.prisma.review.findUnique({
      where: { courseId_userId: { courseId, userId } },
      include: reviewInclude,
    });
    return r ? this.toDto(r) : null;
  }

  async create(
    userId: string,
    courseId: string,
    input: CreateReviewInput,
  ): Promise<ReviewDto> {
    const enrolled = await this.enrollment.isEnrolled(userId, courseId);
    if (!enrolled)
      throw new ForbiddenException("Only enrolled students can review");

    const review = await this.prisma.review.upsert({
      where: { courseId_userId: { courseId, userId } },
      update: { ...input, status: "PENDING" },
      create: { courseId, userId, ...input, status: "PENDING" },
      include: reviewInclude,
    });
    await this.recompute(courseId);
    return this.toDto(review);
  }

  // ── admin moderation ─────────────────────────────────────────────────────
  async adminList(status?: ReviewStatusInput["status"]): Promise<ReviewDto[]> {
    const rows = await this.prisma.review.findMany({
      where: status ? { status } : undefined,
      include: reviewInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((r) => this.toDto(r));
  }

  async setStatus(
    reviewId: string,
    input: ReviewStatusInput,
  ): Promise<ReviewDto> {
    const review = await this.prisma.review.update({
      where: { id: reviewId },
      data: { status: input.status },
      include: reviewInclude,
    });
    await this.recompute(review.courseId);
    return this.toDto(review);
  }

  /** Recompute denormalized course rating from APPROVED reviews. */
  private async recompute(courseId: string): Promise<void> {
    const agg = await this.prisma.review.aggregate({
      where: { courseId, status: "APPROVED" },
      _avg: { rating: true },
      _count: true,
    });
    await this.prisma.course.update({
      where: { id: courseId },
      data: {
        ratingAvg: agg._avg.rating ?? 0,
        reviewCount: agg._count,
      },
    });
  }
}
