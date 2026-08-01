import { ForbiddenException, Injectable } from "@nestjs/common";
import type {
  CreateReviewInput,
  Paginated,
  PaginationQuery,
  ReviewDto,
  ReviewStatusInput,
} from "@skillstream/shared";
import { AdminAlertsService } from "../email/admin-alerts.service";
import { EnrollmentService } from "../enrollment/enrollment.service";
import { ReviewsRepository, type ReviewRow } from "./reviews.repository";

@Injectable()
export class ReviewsService {
  constructor(
    private readonly repo: ReviewsRepository,
    private readonly enrollment: EnrollmentService,
    private readonly alerts: AdminAlertsService,
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
    const [rows, total] = await this.repo.findManyAndCountForCourse(courseId, page);
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
    const rows = await this.repo.findFeatured(limit);
    return rows.map((r) => this.toDto(r));
  }

  async myReview(userId: string, courseId: string): Promise<ReviewDto | null> {
    const r = await this.repo.findByCourseAndUser(userId, courseId);
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

    const review = await this.repo.upsertReview(userId, courseId, input);
    await this.recompute(courseId);
    // Best-effort admin alert; never blocks the learner's review.
    const course = await this.repo.findCourseTitle(courseId);
    void this.alerts.newReview(
      course?.title ?? "a course",
      review.rating,
      review.user.name,
    );
    return this.toDto(review);
  }

  // ── admin moderation ─────────────────────────────────────────────────────
  async adminList(status?: ReviewStatusInput["status"]): Promise<ReviewDto[]> {
    const rows = await this.repo.findManyForAdmin(status);
    return rows.map((r) => this.toDto(r));
  }

  async setStatus(
    reviewId: string,
    input: ReviewStatusInput,
  ): Promise<ReviewDto> {
    const review = await this.repo.updateStatus(reviewId, input.status);
    await this.recompute(review.courseId);
    return this.toDto(review);
  }

  /** Recompute denormalized course rating from APPROVED reviews. */
  private async recompute(courseId: string): Promise<void> {
    const agg = await this.repo.aggregateApprovedForCourse(courseId);
    await this.repo.updateCourseRating(
      courseId,
      agg._avg.rating ?? 0,
      agg._count,
    );
  }
}
