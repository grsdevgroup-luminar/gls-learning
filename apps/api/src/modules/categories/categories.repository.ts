import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActive() {
    return this.prisma.category.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }

  findByName(name: string) {
    return this.prisma.category.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
  }

  findAll() {
    return this.prisma.category.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] });
  }

  countCourses(name: string) {
    return this.prisma.course.count({ where: { category: name } });
  }

  create(data: Prisma.CategoryUncheckedCreateInput) {
    return this.prisma.category.create({ data });
  }

  update(id: string, data: Prisma.CategoryUpdateInput) {
    return this.prisma.category.update({ where: { id }, data });
  }

  renameCourses(oldName: string, newName: string) {
    return this.prisma.course.updateMany({
      where: { category: oldName },
      data: { category: newName },
    });
  }

  delete(id: string) {
    return this.prisma.category.delete({ where: { id } });
  }

  transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(callback);
  }
}
