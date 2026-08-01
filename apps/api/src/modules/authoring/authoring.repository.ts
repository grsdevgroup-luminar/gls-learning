import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { COURSE_DETAIL_INCLUDE, COURSE_SUMMARY_INCLUDE } from "../courses/course.mapper";
import type { Db } from "../../common/types";

@Injectable()
export class AuthoringRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db) {
    return tx ?? this.prisma;
  }

  findCourseInstructor(courseId: string) {
    return this.prisma.course.findUnique({
      where: { id: courseId },
      select: { instructorId: true },
    });
  }

  findSectionCourseId(sectionId: string) {
    return this.prisma.section.findUnique({
      where: { id: sectionId },
      select: { courseId: true },
    });
  }

  findLessonCourseId(lessonId: string) {
    return this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { section: { select: { courseId: true } } },
    });
  }

  findCourseBySlug(slug: string) {
    return this.prisma.course.findUnique({ where: { slug } });
  }

  findCourseDetailOrThrow(id: string) {
    return this.prisma.course.findUniqueOrThrow({
      where: { id },
      include: COURSE_DETAIL_INCLUDE,
    });
  }

  createCourse(data: Prisma.CourseCreateInput) {
    return this.prisma.course.create({ data });
  }

  updateCourse(id: string, data: Prisma.CourseUpdateInput) {
    return this.prisma.course.update({ where: { id }, data });
  }

  findCoursePriorStatus(id: string) {
    return this.prisma.course.findUnique({
      where: { id },
      select: { publishedAt: true, instructorId: true },
    });
  }

  setCourseStatusWithInstructorBump(
    id: string,
    status: Prisma.CourseUpdateInput["status"],
    publishedAt: Date | undefined,
    isFirstPublish: boolean,
    instructorUserId: string | undefined,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.course.update({
        where: { id },
        data: {
          status,
          publishedAt,
        },
      });
      if (isFirstPublish && instructorUserId) {
        await tx.instructorProfile.updateMany({
          where: { userId: instructorUserId },
          data: { courseCount: { increment: 1 } },
        });
      }
    });
  }

  deleteCourse(id: string) {
    return this.prisma.course.delete({ where: { id } });
  }

  findManyCoursesByInstructor(instructorId: string) {
    return this.prisma.course.findMany({
      where: { instructorId },
      include: COURSE_SUMMARY_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });
  }

  countSections(courseId: string) {
    return this.prisma.section.count({ where: { courseId } });
  }

  createSection(data: Prisma.SectionUncheckedCreateInput) {
    return this.prisma.section.create({ data });
  }

  updateSection(sectionId: string, data: Prisma.SectionUpdateInput) {
    return this.prisma.section.update({ where: { id: sectionId }, data });
  }

  deleteSection(sectionId: string) {
    return this.prisma.section.delete({ where: { id: sectionId } });
  }

  countLessons(sectionId: string) {
    return this.prisma.lesson.count({ where: { sectionId } });
  }

  createLesson(data: Prisma.LessonUncheckedCreateInput) {
    return this.prisma.lesson.create({ data });
  }

  updateLesson(lessonId: string, data: Prisma.LessonUpdateInput) {
    return this.prisma.lesson.update({ where: { id: lessonId }, data });
  }

  deleteLesson(lessonId: string) {
    return this.prisma.lesson.delete({ where: { id: lessonId } });
  }

  reorderSections(ids: string[]) {
    return this.prisma.$transaction(
      ids.map((id, i) =>
        this.prisma.section.update({ where: { id }, data: { order: i } }),
      ),
    );
  }

  reorderLessons(ids: string[]) {
    return this.prisma.$transaction(
      ids.map((id, i) =>
        this.prisma.lesson.update({ where: { id }, data: { order: i } }),
      ),
    );
  }

  findQuizLessonId(quizId: string) {
    return this.prisma.quiz.findUnique({
      where: { id: quizId },
      select: { lessonId: true },
    });
  }

  findQuestionQuizLessonId(questionId: string) {
    return this.prisma.quizQuestion.findUnique({
      where: { id: questionId },
      select: { quiz: { select: { lessonId: true } } },
    });
  }

  findQuizDetailOrThrow(quizId: string) {
    return this.prisma.quiz.findUniqueOrThrow({
      where: { id: quizId },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: { options: { orderBy: { order: "asc" } } },
        },
      },
    });
  }

  findQuizByLesson(lessonId: string) {
    return this.prisma.quiz.findUnique({
      where: { lessonId },
      select: { id: true },
    });
  }

  upsertQuiz(lessonId: string, passScore: number) {
    return this.prisma.quiz.upsert({
      where: { lessonId },
      update: { passScore },
      create: { lessonId, passScore },
    });
  }

  updateQuiz(quizId: string, passScore: number) {
    return this.prisma.quiz.update({
      where: { id: quizId },
      data: { passScore },
    });
  }

  deleteQuiz(quizId: string) {
    return this.prisma.quiz.delete({ where: { id: quizId } });
  }

  countQuestions(quizId: string) {
    return this.prisma.quizQuestion.count({ where: { quizId } });
  }

  createQuestion(data: Prisma.QuizQuestionCreateInput) {
    return this.prisma.quizQuestion.create({ data });
  }

  findQuestionQuizIdOrThrow(questionId: string) {
    return this.prisma.quizQuestion.findUniqueOrThrow({
      where: { id: questionId },
      select: { quizId: true },
    });
  }

  updateQuestionWithOptions(
    questionId: string,
    questionData: Prisma.QuizQuestionUpdateInput,
    options:
      | { text: string; isCorrect: boolean; order: number }[]
      | undefined,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.quizQuestion.update({
        where: { id: questionId },
        data: questionData,
      });
      if (options) {
        await tx.quizOption.deleteMany({ where: { questionId } });
        await tx.quizOption.createMany({
          data: options.map((o) => ({
            questionId,
            text: o.text,
            isCorrect: o.isCorrect,
            order: o.order,
          })),
        });
      }
    });
  }

  deleteQuestion(questionId: string) {
    return this.prisma.quizQuestion.delete({ where: { id: questionId } });
  }

  reorderQuestions(ids: string[]) {
    return this.prisma.$transaction(
      ids.map((id, i) =>
        this.prisma.quizQuestion.update({ where: { id }, data: { order: i } }),
      ),
    );
  }
}
