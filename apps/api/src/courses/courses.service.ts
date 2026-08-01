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

@Injectable()
export class CoursesService {
  constructor(private readonly repo: CoursesRepository) {}

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
}
