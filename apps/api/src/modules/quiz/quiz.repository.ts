import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { Db } from "../../common/types";

@Injectable()
export class QuizRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db) {
    return tx ?? this.prisma;
  }

  findLessonContext(lessonId: string) {
    return this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        preview: true,
        section: { select: { courseId: true } },
        quiz: {
          include: {
            questions: {
              orderBy: { order: "asc" },
              include: { options: { orderBy: { order: "asc" } } },
            },
          },
        },
      },
    });
  }

  findQuizResult(userId: string, lessonId: string) {
    return this.prisma.quizResult.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
  }

  saveAttempt(
    userId: string,
    lessonId: string,
    score: number,
    passed: boolean,
    bestScore: number,
    attempts: number,
    prevPassed: boolean,
  ) {
    return this.prisma.$transaction([
      this.prisma.quizResult.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        update: {
          lastScore: score,
          bestScore,
          attempts,
          passed: passed || prevPassed,
          lastAttemptAt: new Date(),
        },
        create: {
          userId,
          lessonId,
          lastScore: score,
          bestScore,
          attempts: 1,
          passed,
        },
      }),
      this.prisma.quizAttempt.create({
        data: { userId, lessonId, score, passed },
      }),
    ]);
  }
}
