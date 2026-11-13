import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { Db } from "../../common/types";
import type { QuizAttemptReviewStatus } from "@prisma/client";

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
              include: { options: { orderBy: { order: "asc" } }, group: true },
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
    options: {
      reviewStatus: QuizAttemptReviewStatus;
      earnedMarks: number;
      totalMarks: number;
      writtenAnswers: { questionId: string; answer: string }[];
    } = { reviewStatus: "AUTO_GRADED", earnedMarks: 0, totalMarks: 0, writtenAnswers: [] },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.quizAttempt.create({
        data: {
          userId,
          lessonId,
          score,
          passed,
          reviewStatus: options.reviewStatus,
          earnedMarks: options.earnedMarks,
          totalMarks: options.totalMarks,
          writtenAnswers: options.writtenAnswers.length
            ? { create: options.writtenAnswers.map((answer) => ({ questionId: answer.questionId, answer: answer.answer })) }
            : undefined,
        },
      });
      await tx.quizResult.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        update: {
          lastScore: score,
          bestScore,
          attempts,
          passed: passed || prevPassed,
          reviewStatus: options.reviewStatus,
          lastAttemptAt: new Date(),
        },
        create: {
          userId,
          lessonId,
          lastScore: score,
          bestScore,
          attempts: 1,
          passed,
          reviewStatus: options.reviewStatus,
        },
      });
      return attempt;
    });
  }

  findCourseReviewerContext(courseId: string) {
    return this.prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, instructorId: true } });
  }

  findQuizSubmissions(courseId: string) {
    return this.prisma.quizAttempt.findMany({
      where: { lesson: { section: { courseId } } },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        lesson: { select: { id: true, title: true, section: { select: { courseId: true, course: { select: { title: true } } } } } },
        writtenAnswers: { select: { id: true, score: true } },
      },
    });
  }

  findQuizSubmission(attemptId: string) {
    return this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        user: { select: { name: true, email: true } },
        lesson: { select: { id: true, title: true, section: { select: { courseId: true, course: { select: { id: true, title: true, instructorId: true } } } } } },
        writtenAnswers: { include: { question: true, gradedBy: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      },
    });
  }

  gradeWrittenAnswer(answerId: string, graderId: string, score: number, feedback: string | null) {
    return this.prisma.writtenAnswerSubmission.update({
      where: { id: answerId },
      data: { score, feedback, gradedById: graderId, gradedAt: new Date() },
    });
  }

  finalizeAttempt(attemptId: string, score: number, passed: boolean, earnedMarks: number, totalMarks: number) {
    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.quizAttempt.update({ where: { id: attemptId }, data: { score, passed, earnedMarks, totalMarks, reviewStatus: "GRADED" } });
      const previous = await tx.quizResult.findUnique({ where: { userId_lessonId: { userId: attempt.userId, lessonId: attempt.lessonId } } });
      await tx.quizResult.update({ where: { userId_lessonId: { userId: attempt.userId, lessonId: attempt.lessonId } }, data: { lastScore: score, bestScore: Math.max(previous?.bestScore ?? 0, score), passed: passed || !!previous?.passed, reviewStatus: "GRADED", lastAttemptAt: new Date() } });
      return attempt;
    });
  }
}
