import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  isLessonSequentiallyAccessible,
  type CourseDetailDto,
  type CourseListQuery,
  type CourseSummaryDto,
  type Paginated,
} from "@skillstream/shared";
import { toCourseDetail, toCourseSummary } from "./course.mapper";
import { CoursesRepository } from "./courses.repository";
import { EnrollmentService } from "../enrollment/enrollment.service";
import { STORAGE_DRIVER } from "../storage/storage.constants";
import type { StorageDriver } from "../storage/storage.driver";
import { signCourseResourceUrls } from "../storage/sign-resources";

function slugCandidates(input: string): string[] {
  let normalized = input.trim().toLowerCase();
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Keep the original value if a malformed encoded slug reaches the API.
  }

  return [...new Set([normalized, normalized.replace(/-and-/g, "-")])];
}

@Injectable()
export class CoursesService {
  constructor(
    private readonly repo: CoursesRepository,
    private readonly enrollment: EnrollmentService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
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
    const rows = await Promise.all(
      slugCandidates(slug).map((candidate) => this.repo.findBySlug(candidate)),
    );
    const row = rows.find((candidate) => candidate !== null);
    if (!row) throw new NotFoundException("Course not found");
    const detail = toCourseDetail(row);
    // Preview lessons expose resources publicly (see mapper); their uploaded
    // files need fresh signed URLs just like the enrolled learning path.
    return signCourseResourceUrls(detail, this.storage);
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
    const accessibleLessonIds = new Set(
      orderedLessonIds.filter((lessonId) =>
        isLessonSequentiallyAccessible(orderedLessonIds, completedIds, lessonId),
      ),
    );

    const detail = toCourseDetail(row, {
      includeLessonResources: true,
      accessibleLessonIds,
    });
    // Uploaded resources persist an object key; the URL served to the browser
    // must be a fresh short-lived signed URL, not the one captured at upload.
    return signCourseResourceUrls(detail, this.storage);
  }
}
