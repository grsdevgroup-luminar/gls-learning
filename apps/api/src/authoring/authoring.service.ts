import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateCourseInput,
  CourseStatusInput,
  CreateQuizInput,
  CreateQuizQuestionInput,
  LessonInput,
  SectionInput,
  UpdateCourseInput,
  UpdateQuizInput,
  UpdateQuizQuestionInput,
} from "@skillstream/shared";
import type { RequestUser } from "../common/decorators";
import { PrismaService } from "../prisma/prisma.service";
import {
  COURSE_DETAIL_INCLUDE,
  COURSE_SUMMARY_INCLUDE,
  toCourseDetail,
  toCourseSummary,
} from "../courses/course.mapper";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

@Injectable()
export class AuthoringService {
  constructor(private readonly prisma: PrismaService) {}

  // ── ownership ──────────────────────────────────────────────────────────
  private async assertCourseAccess(courseId: string, user: RequestUser) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { instructorId: true },
    });
    if (!course) throw new NotFoundException("Course not found");
    if (user.role !== "ADMIN" && course.instructorId !== user.id)
      throw new ForbiddenException("Not your course");
    return course;
  }

  private async courseIdOfSection(sectionId: string): Promise<string> {
    const s = await this.prisma.section.findUnique({
      where: { id: sectionId },
      select: { courseId: true },
    });
    if (!s) throw new NotFoundException("Section not found");
    return s.courseId;
  }

  private async courseIdOfLesson(lessonId: string): Promise<string> {
    const l = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { section: { select: { courseId: true } } },
    });
    if (!l) throw new NotFoundException("Lesson not found");
    return l.section.courseId;
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base || "course";
    let n = 1;
    while (await this.prisma.course.findUnique({ where: { slug } })) {
      slug = `${base}-${n++}`;
    }
    return slug;
  }

  private detail(id: string) {
    return this.prisma.course
      .findUniqueOrThrow({ where: { id }, include: COURSE_DETAIL_INCLUDE })
      .then((row) => toCourseDetail(row, { includeArticleContent: true }));
  }

  /** Owner-gated detail so the course builder can edit drafts. */
  async ownerDetail(user: RequestUser, id: string) {
    await this.assertCourseAccess(id, user);
    return this.detail(id);
  }

  // ── courses ────────────────────────────────────────────────────────────
  async create(user: RequestUser, input: CreateCourseInput) {
    const slug = await this.uniqueSlug(input.slug ?? slugify(input.title));
    const course = await this.prisma.course.create({
      data: {
        slug,
        title: input.title,
        subtitle: input.subtitle,
        description: input.description,
        category: input.category,
        level: input.level,
        thumbnail: input.thumbnail,
        language: input.language,
        basePriceCents: input.basePriceCents,
        originalPriceCents: input.originalPriceCents ?? null,
        whatYouLearn: input.whatYouLearn,
        requirements: input.requirements,
        instructorId: user.id,
        status: "DRAFT",
      },
    });
    return this.detail(course.id);
  }

  async update(user: RequestUser, id: string, input: UpdateCourseInput) {
    await this.assertCourseAccess(id, user);
    await this.prisma.course.update({
      where: { id },
      data: {
        ...input,
        originalPriceCents: input.originalPriceCents ?? undefined,
      },
    });
    return this.detail(id);
  }

  async setStatus(user: RequestUser, id: string, input: CourseStatusInput) {
    await this.assertCourseAccess(id, user);
    // Check prior state BEFORE update to detect first publish.
    const prior = await this.prisma.course.findUnique({
      where: { id },
      select: { publishedAt: true, instructorId: true },
    });
    const isFirstPublish = input.status === "PUBLISHED" && !prior?.publishedAt;
    await this.prisma.$transaction(async (tx) => {
      await tx.course.update({
        where: { id },
        data: {
          status: input.status,
          publishedAt: input.status === "PUBLISHED" ? new Date() : undefined,
        },
      });
      if (isFirstPublish && prior) {
        await tx.instructorProfile.updateMany({
          where: { userId: prior.instructorId },
          data: { courseCount: { increment: 1 } },
        });
      }
    });
    return this.detail(id);
  }

  async remove(user: RequestUser, id: string) {
    await this.assertCourseAccess(id, user);
    await this.prisma.course.delete({ where: { id } });
    return { ok: true as const };
  }

  async myCourses(user: RequestUser) {
    const rows = await this.prisma.course.findMany({
      where: { instructorId: user.id },
      include: COURSE_SUMMARY_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });
    // Owners also get their own revenue figure (not part of the public summary).
    return rows.map((r) => ({ ...toCourseSummary(r), revenueCents: r.revenueCents }));
  }

  // ── sections ───────────────────────────────────────────────────────────
  async addSection(user: RequestUser, courseId: string, input: SectionInput) {
    await this.assertCourseAccess(courseId, user);
    const count = await this.prisma.section.count({ where: { courseId } });
    await this.prisma.section.create({
      data: { courseId, title: input.title, order: input.order ?? count },
    });
    return this.detail(courseId);
  }

  async updateSection(user: RequestUser, sectionId: string, input: SectionInput) {
    const courseId = await this.courseIdOfSection(sectionId);
    await this.assertCourseAccess(courseId, user);
    await this.prisma.section.update({
      where: { id: sectionId },
      data: { title: input.title, order: input.order },
    });
    return this.detail(courseId);
  }

  async removeSection(user: RequestUser, sectionId: string) {
    const courseId = await this.courseIdOfSection(sectionId);
    await this.assertCourseAccess(courseId, user);
    await this.prisma.section.delete({ where: { id: sectionId } });
    return this.detail(courseId);
  }

  // ── lessons ────────────────────────────────────────────────────────────
  async addLesson(user: RequestUser, sectionId: string, input: LessonInput) {
    const courseId = await this.courseIdOfSection(sectionId);
    await this.assertCourseAccess(courseId, user);
    const count = await this.prisma.lesson.count({ where: { sectionId } });
    await this.prisma.lesson.create({
      data: {
        sectionId,
        title: input.title,
        type: input.type,
        durationSec: input.durationSec,
        preview: input.preview,
        order: input.order ?? count,
        articleContent: input.articleContent ?? null,
        cfVideoUid: input.cfVideoUid ?? null,
      },
    });
    return this.detail(courseId);
  }

  async updateLesson(user: RequestUser, lessonId: string, input: LessonInput) {
    const courseId = await this.courseIdOfLesson(lessonId);
    await this.assertCourseAccess(courseId, user);
    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        title: input.title,
        type: input.type,
        durationSec: input.durationSec,
        preview: input.preview,
        order: input.order,
        articleContent: input.articleContent ?? undefined,
        cfVideoUid: input.cfVideoUid ?? undefined,
      },
    });
    return this.detail(courseId);
  }

  async removeLesson(user: RequestUser, lessonId: string) {
    const courseId = await this.courseIdOfLesson(lessonId);
    await this.assertCourseAccess(courseId, user);
    await this.prisma.lesson.delete({ where: { id: lessonId } });
    return this.detail(courseId);
  }

  // ── reorder ────────────────────────────────────────────────────────────
  async reorderSections(user: RequestUser, courseId: string, ids: string[]) {
    await this.assertCourseAccess(courseId, user);
    await this.prisma.$transaction(
      ids.map((id, i) =>
        this.prisma.section.update({ where: { id }, data: { order: i } }),
      ),
    );
    return this.detail(courseId);
  }

  async reorderLessons(user: RequestUser, sectionId: string, ids: string[]) {
    const courseId = await this.courseIdOfSection(sectionId);
    await this.assertCourseAccess(courseId, user);
    await this.prisma.$transaction(
      ids.map((id, i) =>
        this.prisma.lesson.update({ where: { id }, data: { order: i } }),
      ),
    );
    return this.detail(courseId);
  }

  // ── quiz authoring ──────────────────────────────────────────────────────────

  private async assertLessonAccess(lessonId: string, user: RequestUser) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { section: { select: { courseId: true } } },
    });
    if (!lesson) throw new NotFoundException("Lesson not found");
    await this.assertCourseAccess(lesson.section.courseId, user);
    return lesson;
  }

  private async assertQuizAccess(quizId: string, user: RequestUser) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      select: { lessonId: true },
    });
    if (!quiz) throw new NotFoundException("Quiz not found");
    await this.assertLessonAccess(quiz.lessonId, user);
    return quiz;
  }

  private async assertQuestionAccess(questionId: string, user: RequestUser) {
    const q = await this.prisma.quizQuestion.findUnique({
      where: { id: questionId },
      select: { quiz: { select: { lessonId: true } } },
    });
    if (!q) throw new NotFoundException("Question not found");
    await this.assertLessonAccess(q.quiz.lessonId, user);
    return q;
  }

  private quizDetail(quizId: string) {
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

  /** Owner-gated quiz content (with answers) for the course builder. */
  async ownerQuiz(user: RequestUser, lessonId: string) {
    await this.assertLessonAccess(lessonId, user);
    const quiz = await this.prisma.quiz.findUnique({
      where: { lessonId },
      select: { id: true },
    });
    return quiz ? this.quizDetail(quiz.id) : null;
  }

  async createQuiz(user: RequestUser, lessonId: string, input: CreateQuizInput) {
    await this.assertLessonAccess(lessonId, user);
    const quiz = await this.prisma.quiz.upsert({
      where: { lessonId },
      update: { passScore: input.passScore },
      create: { lessonId, passScore: input.passScore },
    });
    return this.quizDetail(quiz.id);
  }

  async updateQuiz(user: RequestUser, quizId: string, input: UpdateQuizInput) {
    await this.assertQuizAccess(quizId, user);
    await this.prisma.quiz.update({
      where: { id: quizId },
      data: { passScore: input.passScore },
    });
    return this.quizDetail(quizId);
  }

  async deleteQuiz(user: RequestUser, quizId: string) {
    await this.assertQuizAccess(quizId, user);
    await this.prisma.quiz.delete({ where: { id: quizId } });
    return { ok: true as const };
  }

  async addQuestion(user: RequestUser, quizId: string, input: CreateQuizQuestionInput) {
    await this.assertQuizAccess(quizId, user);
    const count = await this.prisma.quizQuestion.count({ where: { quizId } });
    await this.prisma.quizQuestion.create({
      data: {
        quizId,
        prompt: input.prompt,
        explanation: input.explanation ?? null,
        order: input.order ?? count,
        options: {
          create: input.options.map((o, i) => ({
            text: o.text,
            isCorrect: o.isCorrect,
            order: o.order ?? i,
          })),
        },
      },
    });
    return this.quizDetail(quizId);
  }

  async updateQuestion(
    user: RequestUser,
    questionId: string,
    input: UpdateQuizQuestionInput,
  ) {
    const q = await this.assertQuestionAccess(questionId, user);
    const quizId = await this.prisma.quizQuestion
      .findUniqueOrThrow({ where: { id: questionId }, select: { quizId: true } })
      .then((r) => r.quizId);

    await this.prisma.$transaction(async (tx) => {
      await tx.quizQuestion.update({
        where: { id: questionId },
        data: {
          prompt: input.prompt,
          explanation: input.explanation ?? undefined,
          order: input.order,
        },
      });
      if (input.options) {
        await tx.quizOption.deleteMany({ where: { questionId } });
        await tx.quizOption.createMany({
          data: input.options.map((o, i) => ({
            questionId,
            text: o.text,
            isCorrect: o.isCorrect,
            order: o.order ?? i,
          })),
        });
      }
    });
    return this.quizDetail(quizId);
  }

  async deleteQuestion(user: RequestUser, questionId: string) {
    await this.assertQuestionAccess(questionId, user);
    const quizId = await this.prisma.quizQuestion
      .findUniqueOrThrow({ where: { id: questionId }, select: { quizId: true } })
      .then((r) => r.quizId);
    await this.prisma.quizQuestion.delete({ where: { id: questionId } });
    return this.quizDetail(quizId);
  }

  async reorderQuestions(user: RequestUser, quizId: string, ids: string[]) {
    await this.assertQuizAccess(quizId, user);
    await this.prisma.$transaction(
      ids.map((id, i) =>
        this.prisma.quizQuestion.update({ where: { id }, data: { order: i } }),
      ),
    );
    return this.quizDetail(quizId);
  }
}
