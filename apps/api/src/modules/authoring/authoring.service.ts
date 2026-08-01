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
import type { RequestUser } from "../../common/decorators/decorators";
import { AuthoringRepository } from "./authoring.repository";
import {
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
  constructor(private readonly repo: AuthoringRepository) {}

  // ── ownership ──────────────────────────────────────────────────────────
  private async assertCourseAccess(courseId: string, user: RequestUser) {
    const course = await this.repo.findCourseInstructor(courseId);
    if (!course) throw new NotFoundException("Course not found");
    if (user.role !== "ADMIN" && course.instructorId !== user.id)
      throw new ForbiddenException("Not your course");
    return course;
  }

  private async courseIdOfSection(sectionId: string): Promise<string> {
    const s = await this.repo.findSectionCourseId(sectionId);
    if (!s) throw new NotFoundException("Section not found");
    return s.courseId;
  }

  private async courseIdOfLesson(lessonId: string): Promise<string> {
    const l = await this.repo.findLessonCourseId(lessonId);
    if (!l) throw new NotFoundException("Lesson not found");
    return l.section.courseId;
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base || "course";
    let n = 1;
    while (await this.repo.findCourseBySlug(slug)) {
      slug = `${base}-${n++}`;
    }
    return slug;
  }

  private detail(id: string) {
    return this.repo
      .findCourseDetailOrThrow(id)
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
    const course = await this.repo.createCourse({
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
      instructor: { connect: { id: user.id } },
      status: "DRAFT",
    });
    return this.detail(course.id);
  }

  async update(user: RequestUser, id: string, input: UpdateCourseInput) {
    await this.assertCourseAccess(id, user);
    await this.repo.updateCourse(id, {
      ...input,
      originalPriceCents: input.originalPriceCents ?? undefined,
    });
    return this.detail(id);
  }

  async setStatus(user: RequestUser, id: string, input: CourseStatusInput) {
    await this.assertCourseAccess(id, user);
    // Check prior state BEFORE update to detect first publish.
    const prior = await this.repo.findCoursePriorStatus(id);
    const isFirstPublish = input.status === "PUBLISHED" && !prior?.publishedAt;
    await this.repo.setCourseStatusWithInstructorBump(
      id,
      input.status,
      input.status === "PUBLISHED" ? new Date() : undefined,
      isFirstPublish,
      prior?.instructorId,
    );
    return this.detail(id);
  }

  async remove(user: RequestUser, id: string) {
    await this.assertCourseAccess(id, user);
    await this.repo.deleteCourse(id);
    return { ok: true as const };
  }

  async myCourses(user: RequestUser) {
    const rows = await this.repo.findManyCoursesByInstructor(user.id);
    // Owners also get their own revenue figure (not part of the public summary).
    return rows.map((r) => ({ ...toCourseSummary(r), revenueCents: r.revenueCents }));
  }

  // ── sections ───────────────────────────────────────────────────────────
  async addSection(user: RequestUser, courseId: string, input: SectionInput) {
    await this.assertCourseAccess(courseId, user);
    const count = await this.repo.countSections(courseId);
    await this.repo.createSection({
      courseId,
      title: input.title,
      order: input.order ?? count,
    });
    return this.detail(courseId);
  }

  async updateSection(user: RequestUser, sectionId: string, input: SectionInput) {
    const courseId = await this.courseIdOfSection(sectionId);
    await this.assertCourseAccess(courseId, user);
    await this.repo.updateSection(sectionId, {
      title: input.title,
      order: input.order,
    });
    return this.detail(courseId);
  }

  async removeSection(user: RequestUser, sectionId: string) {
    const courseId = await this.courseIdOfSection(sectionId);
    await this.assertCourseAccess(courseId, user);
    await this.repo.deleteSection(sectionId);
    return this.detail(courseId);
  }

  // ── lessons ────────────────────────────────────────────────────────────
  async addLesson(user: RequestUser, sectionId: string, input: LessonInput) {
    const courseId = await this.courseIdOfSection(sectionId);
    await this.assertCourseAccess(courseId, user);
    const count = await this.repo.countLessons(sectionId);
    await this.repo.createLesson({
      sectionId,
      title: input.title,
      type: input.type,
      durationSec: input.durationSec,
      preview: input.preview,
      order: input.order ?? count,
      articleContent: input.articleContent ?? null,
      cfVideoUid: input.cfVideoUid ?? null,
      resources: input.resources ?? [],
    });
    return this.detail(courseId);
  }

  async updateLesson(user: RequestUser, lessonId: string, input: LessonInput) {
    const courseId = await this.courseIdOfLesson(lessonId);
    await this.assertCourseAccess(courseId, user);
    await this.repo.updateLesson(lessonId, {
      title: input.title,
      type: input.type,
      durationSec: input.durationSec,
      preview: input.preview,
      order: input.order,
      articleContent: input.articleContent ?? undefined,
      cfVideoUid: input.cfVideoUid ?? undefined,
      // Omitted `resources` leaves the existing attachments alone; an empty
      // array clears them.
      resources: input.resources ?? undefined,
    });
    return this.detail(courseId);
  }

  async removeLesson(user: RequestUser, lessonId: string) {
    const courseId = await this.courseIdOfLesson(lessonId);
    await this.assertCourseAccess(courseId, user);
    await this.repo.deleteLesson(lessonId);
    return this.detail(courseId);
  }

  // ── reorder ────────────────────────────────────────────────────────────
  async reorderSections(user: RequestUser, courseId: string, ids: string[]) {
    await this.assertCourseAccess(courseId, user);
    await this.repo.reorderSections(ids);
    return this.detail(courseId);
  }

  async reorderLessons(user: RequestUser, sectionId: string, ids: string[]) {
    const courseId = await this.courseIdOfSection(sectionId);
    await this.assertCourseAccess(courseId, user);
    await this.repo.reorderLessons(ids);
    return this.detail(courseId);
  }

  // ── quiz authoring ──────────────────────────────────────────────────────────

  private async assertLessonAccess(lessonId: string, user: RequestUser) {
    const lesson = await this.repo.findLessonCourseId(lessonId);
    if (!lesson) throw new NotFoundException("Lesson not found");
    await this.assertCourseAccess(lesson.section.courseId, user);
    return lesson;
  }

  private async assertQuizAccess(quizId: string, user: RequestUser) {
    const quiz = await this.repo.findQuizLessonId(quizId);
    if (!quiz) throw new NotFoundException("Quiz not found");
    await this.assertLessonAccess(quiz.lessonId, user);
    return quiz;
  }

  private async assertQuestionAccess(questionId: string, user: RequestUser) {
    const q = await this.repo.findQuestionQuizLessonId(questionId);
    if (!q) throw new NotFoundException("Question not found");
    await this.assertLessonAccess(q.quiz.lessonId, user);
    return q;
  }

  private quizDetail(quizId: string) {
    return this.repo.findQuizDetailOrThrow(quizId);
  }

  /** Owner-gated quiz content (with answers) for the course builder. */
  async ownerQuiz(user: RequestUser, lessonId: string) {
    await this.assertLessonAccess(lessonId, user);
    const quiz = await this.repo.findQuizByLesson(lessonId);
    return quiz ? this.quizDetail(quiz.id) : null;
  }

  async createQuiz(user: RequestUser, lessonId: string, input: CreateQuizInput) {
    await this.assertLessonAccess(lessonId, user);
    const quiz = await this.repo.upsertQuiz(lessonId, input.passScore);
    return this.quizDetail(quiz.id);
  }

  async updateQuiz(user: RequestUser, quizId: string, input: UpdateQuizInput) {
    await this.assertQuizAccess(quizId, user);
    await this.repo.updateQuiz(quizId, input.passScore);
    return this.quizDetail(quizId);
  }

  async deleteQuiz(user: RequestUser, quizId: string) {
    await this.assertQuizAccess(quizId, user);
    await this.repo.deleteQuiz(quizId);
    return { ok: true as const };
  }

  async addQuestion(user: RequestUser, quizId: string, input: CreateQuizQuestionInput) {
    await this.assertQuizAccess(quizId, user);
    const count = await this.repo.countQuestions(quizId);
    await this.repo.createQuestion({
      quiz: { connect: { id: quizId } },
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
    });
    return this.quizDetail(quizId);
  }

  async updateQuestion(
    user: RequestUser,
    questionId: string,
    input: UpdateQuizQuestionInput,
  ) {
    await this.assertQuestionAccess(questionId, user);
    const quizId = await this.repo
      .findQuestionQuizIdOrThrow(questionId)
      .then((r) => r.quizId);

    await this.repo.updateQuestionWithOptions(
      questionId,
      {
        prompt: input.prompt,
        explanation: input.explanation ?? undefined,
        order: input.order,
      },
      input.options?.map((o, i) => ({
        text: o.text,
        isCorrect: o.isCorrect,
        order: o.order ?? i,
      })),
    );
    return this.quizDetail(quizId);
  }

  async deleteQuestion(user: RequestUser, questionId: string) {
    await this.assertQuestionAccess(questionId, user);
    const quizId = await this.repo
      .findQuestionQuizIdOrThrow(questionId)
      .then((r) => r.quizId);
    await this.repo.deleteQuestion(questionId);
    return this.quizDetail(quizId);
  }

  async reorderQuestions(user: RequestUser, quizId: string, ids: string[]) {
    await this.assertQuizAccess(quizId, user);
    await this.repo.reorderQuestions(ids);
    return this.quizDetail(quizId);
  }
}
