import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CourseDetailDto,
  CourseListQuery,
  CourseSummaryDto,
  Paginated,
} from "@skillstream/shared";
import { toCourseDetail, toCourseSummary } from "./course.mapper";
import { CoursesRepository } from "./courses.repository";
import { EnrollmentService } from "../enrollment/enrollment.service";

@Injectable()
export class CoursesService {
  constructor(
    private readonly repo: CoursesRepository,
    private readonly enrollment: EnrollmentService,
  ) {}

  private orderBy(
    sort: CourseListQuery["sort"],
  ): Prisma.CourseOrderByWithRelationInput {
    switch (sort) {
      case "newest":
        return { publishedAt: "desc" };
      case "rating":
        return { ratingAvg: "desc" };
      case "price_asc":
        return { basePriceCents: "asc" };
      case "price_desc":
        return { basePriceCents: "desc" };
      case "popular":
      default:
        return { studentCount: "desc" };
    }
  }

  async list(query: CourseListQuery): Promise<Paginated<CourseSummaryDto>> {
    // Public catalog never exposes org-private courses.
    const where: Prisma.CourseWhereInput = {
      status: "PUBLISHED",
      visibility: "PUBLIC",
    };
    if (query.category) where.category = query.category;
    if (query.level) where.level = query.level;
    if (query.minPriceCents !== undefined || query.maxPriceCents !== undefined) {
      where.basePriceCents = {
        ...(query.minPriceCents !== undefined && { gte: query.minPriceCents }),
        ...(query.maxPriceCents !== undefined && { lte: query.maxPriceCents }),
      };
    }
    if (query.minRating !== undefined) where.ratingAvg = { gte: query.minRating };
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: "insensitive" } },
        { subtitle: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
      ];
    }

    const [rows, total] = await this.repo.listAndCount(
      where,
      this.orderBy(query.sort),
      (query.page - 1) * query.pageSize,
      query.pageSize,
    );

    return {
      items: rows.map(toCourseSummary),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async categories(): Promise<string[]> {
    const rows = await this.repo.findDistinctCategories();
    return rows.map((r) => r.category);
  }

  async bySlug(slug: string): Promise<CourseDetailDto> {
    const row = await this.repo.findBySlug(slug);
    if (!row) throw new NotFoundException("Course not found");
    return toCourseDetail(row);
  }

  /** Enrolled learner view. Resource links are returned only for lessons the
   * learner has reached; the actual lesson body/video is still protected by
   * the playback and quiz endpoints. */
  async learning(userId: string, courseId: string): Promise<CourseDetailDto> {
    const completedIds = await this.enrollment.completedLessonIds(userId, courseId);
    const row = await this.repo.findById(courseId);
    if (!row) throw new NotFoundException("Course not found");

    const orderedLessonIds = row.sections.flatMap((section) =>
      section.lessons.map((lesson) => lesson.id),
    );
    const completed = new Set(completedIds);
    const accessibleLessonIds = new Set<string>();
    for (const [index, lessonId] of orderedLessonIds.entries()) {
      if (
        orderedLessonIds
          .slice(0, index)
          .every((previousId) => completed.has(previousId))
      ) {
        accessibleLessonIds.add(lessonId);
      }
    }

    return toCourseDetail(row, {
      includeLessonResources: true,
      accessibleLessonIds,
    });
  }
}
