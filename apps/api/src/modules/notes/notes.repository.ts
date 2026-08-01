import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class NotesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findLessonCourseId(lessonId: string) {
    return this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { section: { select: { courseId: true } } },
    });
  }

  countEnrollment(userId: string, courseId: string) {
    return this.prisma.enrollment.count({
      where: { userId, courseId },
    });
  }

  findNote(userId: string, lessonId: string) {
    return this.prisma.lessonNote.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
  }

  deleteNote(userId: string, lessonId: string) {
    return this.prisma.lessonNote.delete({
      where: { userId_lessonId: { userId, lessonId } },
    });
  }

  upsertNote(userId: string, lessonId: string, body: string) {
    return this.prisma.lessonNote.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { body },
      create: { userId, lessonId, body },
    });
  }
}
