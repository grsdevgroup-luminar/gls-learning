import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  parseLessonResources,
  type LessonResourceInput,
} from "@skillstream/shared";
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
      select: {
        instructorId: true,
        category: true,
        status: true,
        visibility: true,
        // The rest are only read to diff against an admin's edit for the
        // "what changed" notification (see AuthoringService.diffCourseFields)
        // — cheap to carry along on this single primary-key lookup, which
        // every authoring mutation already calls for the ownership check.
        title: true,
        subtitle: true,
        description: true,
        isoStandard: true,
        level: true,
        thumbnail: true,
        basePriceCents: true,
      },
    });
  }

  /** How many orgs a course is currently assigned to — used to block
   *  unpublishing or un-privatizing a course that's actively in use by an org. */
  countOrgAssignments(courseId: string) {
    return this.prisma.courseOrgAssignment.count({ where: { courseId } });
  }

  /** Returns lesson content needed to validate a publish transition. */
  findLessonsForPublishValidation(courseId: string) {
    return this.prisma.lesson.findMany({
      where: { section: { courseId } },
      select: {
        title: true,
        type: true,
        articleContent: true,
        cfVideoUid: true,
        resources: true,
        quiz: {
          select: {
            questions: {
              select: {
                prompt: true,
                options: { select: { text: true, isCorrect: true } },
              },
            },
          },
        },
      },
    });
  }

  findSectionCourseId(sectionId: string) {
    return this.prisma.section.findUnique({
      where: { id: sectionId },
      select: { courseId: true },
    });
  }

  /** Used only to diff against an incoming edit — see
   *  AuthoringService.updateSection — so the "admin changed your course"
   *  notification fires on real changes, not the builder's unconditional
   *  re-save of every section on each Save click. */
  findSectionForDiff(sectionId: string) {
    return this.prisma.section.findUnique({
      where: { id: sectionId },
      select: { title: true, order: true },
    });
  }

  findLessonCourseId(lessonId: string) {
    return this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { section: { select: { courseId: true } } },
    });
  }

  /** Same purpose as findSectionForDiff, for AuthoringService.updateLesson. */
  findLessonForDiff(lessonId: string) {
    return this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        title: true,
        type: true,
        durationSec: true,
        preview: true,
        order: true,
        articleContent: true,
        cfVideoUid: true,
      },
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

  updateLesson(lessonId: string, data: Prisma.LessonUpdateInput, tx?: Db) {
    return this.db(tx).lesson.update({ where: { id: lessonId }, data });
  }

  runTransaction<T>(fn: (tx: Db) => Promise<T>) {
    return this.prisma.$transaction(fn);
  }

  deleteLesson(lessonId: string) {
    return this.prisma.lesson.delete({ where: { id: lessonId } });
  }

  /** Reads the JSON resources column for a lesson via a lightweight select. */
  findLessonResources(lessonId: string) {
    return this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, resources: true },
    });
  }

  findLessonCfVideoUid(lessonId: string) {
    return this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { cfVideoUid: true },
    });
  }

  findCfVideoUidsBySection(sectionId: string) {
    return this.prisma.lesson.findMany({
      where: { sectionId, cfVideoUid: { not: null } },
      select: { cfVideoUid: true },
    });
  }

  findCfVideoUidsByCourse(courseId: string) {
    return this.prisma.lesson.findMany({
      where: { section: { courseId }, cfVideoUid: { not: null } },
      select: { cfVideoUid: true },
    });
  }

  /** Appends a resource to `Lesson.resources` inside a transaction so a
   *  concurrent upload can't overwrite the other. Enforces the shared cap of
   *  20 attachments per lesson. Returns the full resource list post-append. */
  async appendLessonResource(
    lessonId: string,
    resource: LessonResourceInput,
    limit: number,
  ): Promise<LessonResourceInput[]> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.lesson.findUnique({
        where: { id: lessonId },
        select: { resources: true },
      });
      if (!row) throw new NotFoundException("Lesson not found");
      const existing = parseLessonResources(row.resources);
      if (existing.length >= limit) {
        // Surface the cap explicitly; callers translate to 400 for the client.
        throw new Error("RESOURCE_LIMIT_REACHED");
      }
      const next = [...existing, resource];
      await tx.lesson.update({
        where: { id: lessonId },
        data: { resources: next as unknown as Prisma.InputJsonValue },
      });
      return next;
    });
  }

  /** Removes a resource by its storageKey. Returns the removed entry and the
   *  updated list so the caller can `StorageDriver.delete(key)` after commit. */
  async removeLessonResourceByStorageKey(
    lessonId: string,
    storageKey: string,
  ): Promise<{
    removed: LessonResourceInput | null;
    remaining: LessonResourceInput[];
  }> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.lesson.findUnique({
        where: { id: lessonId },
        select: { resources: true },
      });
      if (!row) throw new NotFoundException("Lesson not found");
      const existing = parseLessonResources(row.resources);
      const removed = existing.find((r) => r.storageKey === storageKey) ?? null;
      const remaining = existing.filter((r) => r.storageKey !== storageKey);
      if (removed) {
        await tx.lesson.update({
          where: { id: lessonId },
          data: { resources: remaining as unknown as Prisma.InputJsonValue },
        });
      }
      return { removed, remaining };
    });
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
