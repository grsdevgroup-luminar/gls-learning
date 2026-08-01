import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  findLessonForPlayback(lessonId: string) {
    return this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        type: true,
        preview: true,
        articleContent: true,
        cfVideoUid: true,
        section: { select: { courseId: true } },
      },
    });
  }
}
