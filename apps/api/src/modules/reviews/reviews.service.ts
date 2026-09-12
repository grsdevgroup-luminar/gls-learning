import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  AdminReviewCourseOptionDto,
  AdminReviewQuery,
  AdminReviewStatsDto,
  CreateReviewInput,
  Paginated,
  PaginationQuery,
  ReviewDto,
  ReviewStatusInput,
} from "@skillstream/shared";
import type { RequestUser } from "../../common/decorators/decorators";
import { AdminAlertsService } from "../email/admin-alerts.service";
import { EnrollmentService } from "../enrollment/enrollment.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ReviewsRepository, type ReviewRow } from "./reviews.repository";

@Injectable()
export class ReviewsService {
  constructor(
    private readonly repo: ReviewsRepository,
    private readonly enrollment: EnrollmentService,
    private readonly alerts: AdminAlertsService,
    private readonly notifications: NotificationsService,
  ) { }

  private toDto(r: ReviewRow): ReviewDto {
    return {
      id: r.id,
      courseId: r.courseId,
      author: r.user.name,
      avatar: r.user.avatar,
      rating: r.rating,
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
    const canReview = await this.enrollment.canReview(userId, courseId);

    if (!canReview) {
      throw new ForbiddenException(
        "You must be enrolled in this course before submitting a review",
      );
    }

    const review = await this.repo.upsertReview(userId, courseId, input);
    await this.recompute(courseId);
    // Best-effort admin alert; never blocks the learner's review.
    const course = await this.repo.findCourseTitle(courseId);
    void this.alerts.newReview(
      course?.title ?? "a course",
      review.rating,
      review.user.name,
    );
    // In-app only (no email) — see NOTIFICATION_SYSTEM_PLAN.md's Phase 3 taxonomy.
    if (course) {
      void this.notifications
        .notify({
          userId: course.instructorId,
          event: "COURSE_NEW_REVIEW",
          title: "New review",
          body: `${review.user.name} left a ${review.rating}-star review on "${course.title}".`,
          href: `/instructor/courses/${courseId}/reviews`,
          skipEmail: true,
        })
        .catch(() => undefined);
      // Reviews are pre-moderated (start PENDING, invisible to everyone but
      // their author until approved) — admins are the only ones who can act,
      // so they get the in-app alert deep-linked straight to this review,
      // same gap as the purchase notification.
      void this.notifications
        .notifyAdmins({
          event: "COURSE_NEW_REVIEW",
          title: "New review pending approval",
          body: `${review.user.name} left a ${review.rating}-star review on "${course.title}".`,
          href: `/admin/reviews?reviewId=${review.id}`,
          skipEmail: true,
        })
        .catch(() => undefined);
    }
    return this.toDto(review);
  }

  /** The instructor's own preview of their course's reviews, any status —
   *  the public listing only ever shows APPROVED ones, but the owner
   *  shouldn't have to wait on moderation to see what was written. */
  async forInstructorCourse(
    user: RequestUser,
    courseId: string,
    page: PaginationQuery,
  ): Promise<Paginated<ReviewDto>> {
    const course = await this.repo.findCourseTitle(courseId);
    if (!course) throw new NotFoundException("Course not found");
    if (user.role !== "ADMIN" && course.instructorId !== user.id) {
      throw new ForbiddenException("Not your course");
    }

    const [rows, total] = await this.repo.findManyAndCountForAdmin({ courseId }, page);
    return {
      items: rows.map((r) => this.toDto(r)),
      page: page.page,
      pageSize: page.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / page.pageSize)),
    };
  }

  // ── admin moderation ─────────────────────────────────────────────────────
  async adminList(query: AdminReviewQuery): Promise<Paginated<ReviewDto>> {
    const q = query.q?.trim();
    const where: Prisma.ReviewWhereInput = {
      ...(query.reviewId ? { id: query.reviewId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.rating ? { rating: query.rating } : {}),
      ...(q
        ? {
          OR: [
            { body: { contains: q, mode: "insensitive" } },
            { user: { name: { contains: q, mode: "insensitive" } } },
            { course: { title: { contains: q, mode: "insensitive" } } },
          ],
        }
        : {}),
    };
    const [rows, total] = await this.repo.findManyAndCountForAdmin(where, query);
    return {
      items: rows.map((r) => this.toDto(r)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async adminStats(): Promise<AdminReviewStatsDto> {
    const [approvedAgg, pending] = await this.repo.adminStats();
    return {
      avgRating: approvedAgg._avg.rating ?? 0,
      approved: approvedAgg._count,
      pending,
    };
  }

  async adminCourses(): Promise<AdminReviewCourseOptionDto[]> {
    const rows = await this.repo.findDistinctCourses();
    return rows
      .map((r) => ({ id: r.courseId, title: r.course.title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  async setStatus(
    reviewId: string,
    input: ReviewStatusInput,
  ): Promise<ReviewDto> {
    const review = await this.repo.updateStatus(reviewId, input.action);
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
