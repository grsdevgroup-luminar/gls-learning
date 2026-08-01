import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
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

  findDistinctCategories() {
    return this.prisma.course.findMany({
      where: { status: "PUBLISHED" },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    });
  }

  findBySlug(slug: string) {
    return this.prisma.course.findUnique({
      where: { slug },
      include: COURSE_DETAIL_INCLUDE,
    });
  }
}
