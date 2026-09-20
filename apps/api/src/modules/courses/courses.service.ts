import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  isLessonSequentiallyAccessible,
  type CourseDetailDto,
  type CourseListQuery,
  type CourseSummaryDto,
  type Paginated,
  LEARNING_CATEGORIES,
  compactCourseSearchQuery,
} from "@skillstream/shared";
import { toCourseDetail, toCourseSummary } from "./course.mapper";
import { CoursesRepository } from "./courses.repository";
import type { RequestUser } from "../../common/decorators/decorators";
import { EnrollmentService } from "../enrollment/enrollment.service";
import { STORAGE_DRIVER } from "../storage/storage.constants";
import type { StorageDriver } from "../storage/storage.driver";
import { signCourseResourceUrls } from "../storage/sign-resources";
import { CategoriesService } from "../categories/categories.service";

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
    private readonly categoriesRepo: CategoriesService,
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
    if (query.category) {
      where.category = Array.isArray(query.category)
        ? { in: query.category }
        : query.category;
    }
    if (query.level) where.level = query.level;
    if (query.instructorId) where.instructorId = query.instructorId;
    if (query.minPriceCents !== undefined || query.maxPriceCents !== undefined) {
      where.basePriceCents = {
        ...(query.minPriceCents !== undefined && { gte: query.minPriceCents }),
        ...(query.maxPriceCents !== undefined && { lte: query.maxPriceCents }),
      };
    }
    if (query.minRating !== undefined) where.ratingAvg = { gte: query.minRating };
    if (query.q) {
      const search = query.q.trim();
      const compactSearch = compactCourseSearchQuery(search);
      const spacedCategoryMatches = LEARNING_CATEGORIES.filter(
        (category) => compactCourseSearchQuery(category) === compactSearch,
      );
      const searchTerms = [search, ...spacedCategoryMatches];

      // Include the canonical spaced category when a compact term such as
      // "webdevelopment" is searched, so that courses in the "Web Development"
      // category are returned even though their category field is not a direct
      // match for the compact term. Keep any explicit category filter above;
      // replacing it here would silently discard the user's selection.
      const textMatches = searchTerms.flatMap((term) => [
        { title: { contains: term, mode: "insensitive" as const } },
        { category: { contains: term, mode: "insensitive" as const } },
      ]);

      // Prisma's `contains` cannot ignore separators inside a field. Restrict
      // the normal filtered query to ids found by the database's normalized
      // title/category expression so compact searches also work.
      const compactMatches = await this.repo.findIdsByCompactSearch(search);
      const compactMatchIds = compactMatches.map(({ id }) => id);

      // Keep both paths under the same OR: a compact title such as
      // `learncloudcomputing` must not be found by the normalized lookup and
      // then rejected because it does not also contain the unspaced string.
      where.OR = [
        ...textMatches,
        ...(compactMatchIds.length > 0 ? [{ id: { in: compactMatchIds } }] : []),
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
    return this.categoriesRepo.activeNames();
  }

  async recommendedFor(userId: string, categories: string[], keywords: string[] = [], limit = 8) {
    if (categories.length === 0) return [];
    const rows = await this.repo.findRecommendedForStudent(
      userId,
      categories,
      keywords,
      Math.min(Math.max(limit, 1), 24),
    );
    return rows.map(toCourseSummary);
  }

  async bySlug(slug: string, user?: RequestUser): Promise<CourseDetailDto> {
    const rows = await Promise.all(
      slugCandidates(slug).map((candidate) => this.repo.findBySlug(candidate)),
    );
    const row = rows.find((candidate) => candidate !== null);
    if (!row) throw new NotFoundException("Course not found");
    if (row.status !== "PUBLISHED" && user?.role !== "ADMIN")
      throw new NotFoundException("Course not found");
    if (row.visibility === "PRIVATE" && user?.role !== "ADMIN") {
      const orgIds = row.orgAssignments.map((a) => a.orgId);
      const isOrgMember = user ? await this.enrollment.isOrgMemberOfAny(orgIds, user.id) : false;
      // Delivery-partner course assignment is the other path to a PRIVATE
      // course (see DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §6.3) — same as
      // enrollFree/assertLessonAccessible already check.
      const isPartnerMember = user
        ? await this.enrollment.isPartnerMemberOfCourse(row.id, user.id)
        : false;
      if (!isOrgMember && !isPartnerMember) throw new NotFoundException("Course not found");
    }
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
