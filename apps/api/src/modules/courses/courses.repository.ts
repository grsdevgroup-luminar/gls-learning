import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { COURSE_DETAIL_INCLUDE, COURSE_SUMMARY_INCLUDE } from "./course.mapper";

@Injectable()
export class CoursesRepository {
  constructor(private readonly prisma: PrismaService) {}

  listAndCount(
    where: Prisma.CourseWhereInput,
    orderBy: Prisma.CourseOrderByWithRelationInput,
    skip: number,
    take: number,
  ) {
    return this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        include: COURSE_SUMMARY_INCLUDE,
        orderBy,
        skip,
        take,
      }),
      this.prisma.course.count({ where }),
    ]);
  }

  /** Find public course ids using a separator-insensitive title/category match.
   * This makes searches such as `react18mastery` match "React 18 Mastery". */
  findIdsByCompactSearch(keyword: string) {
    return this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id"
      FROM "Course"
      WHERE "status" = 'PUBLISHED'
        AND "visibility" = 'PUBLIC'
        AND regexp_replace(
          lower(concat_ws(' ', "title", "category")),
          '[^[:alnum:]]', '', 'g'
        ) LIKE '%' || regexp_replace(lower(${keyword}), '[^[:alnum:]]', '', 'g') || '%'
    `);
  }

  findDistinctCategories() {
    return this.prisma.course.findMany({
      where: { status: "PUBLISHED" },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    });
  }

  findRecommendedForStudent(userId: string, categories: string[], keywords: string[], take: number) {
    const normalizedKeywords = keywords.map((keyword) => keyword.trim()).filter(Boolean);
    const keywordMatches = normalizedKeywords.flatMap((keyword) => [
      { title: { contains: keyword, mode: "insensitive" as const } },
      { subtitle: { contains: keyword, mode: "insensitive" as const } },
      { description: { contains: keyword, mode: "insensitive" as const } },
    ]);
    return this.prisma.course.findMany({
      where: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        category: { in: categories },
        ...(keywordMatches.length > 0 ? { OR: keywordMatches } : {}),
        enrollments: { none: { userId } },
      },
      include: COURSE_SUMMARY_INCLUDE,
      orderBy: [{ bestseller: "desc" }, { studentCount: "desc" }, { ratingAvg: "desc" }],
      take,
    });
  }

  findBySlug(slug: string) {
    return this.prisma.course.findUnique({
      where: { slug },
      include: COURSE_DETAIL_INCLUDE,
    });
  }

  findById(id: string) {
    return this.prisma.course.findUnique({
      where: { id },
      include: COURSE_DETAIL_INCLUDE,
    });
  }
}
