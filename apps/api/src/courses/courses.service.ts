import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CourseDetailDto,
  CourseListQuery,
  CourseSummaryDto,
  Paginated,
} from "@skillstream/shared";
import { PrismaService } from "../prisma/prisma.service";
import {
  COURSE_DETAIL_INCLUDE,
  COURSE_SUMMARY_INCLUDE,
  toCourseDetail,
  toCourseSummary,
} from "./course.mapper";

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

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

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        include: COURSE_SUMMARY_INCLUDE,
        orderBy: this.orderBy(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.course.count({ where }),
    ]);

    return {
      items: rows.map(toCourseSummary),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async categories(): Promise<string[]> {
    const rows = await this.prisma.course.findMany({
      where: { status: "PUBLISHED" },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    });
    return rows.map((r) => r.category);
  }

  async bySlug(slug: string): Promise<CourseDetailDto> {
    const row = await this.prisma.course.findUnique({
      where: { slug },
      include: COURSE_DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException("Course not found");
    return toCourseDetail(row);
  }
}
