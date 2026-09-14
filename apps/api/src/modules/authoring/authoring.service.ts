import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  parseLessonResources,
  type CreateCourseInput,
  type CourseStatusInput,
  type CreateQuizInput,
  type CreateQuizQuestionInput,
  type LessonInput,
  type SectionInput,
  type UpdateCourseInput,
  type UpdateQuizInput,
  type UpdateQuizQuestionInput,
} from "@skillstream/shared";
import type { RequestUser } from "../../common/decorators/decorators";
import { AuthoringRepository } from "./authoring.repository";
import {
  toCourseDetail,
  toCourseSummary,
} from "../courses/course.mapper";
import { STORAGE_DRIVER } from "../storage/storage.constants";
import type { StorageDriver } from "../storage/storage.driver";
import { signCourseResourceUrls } from "../storage/sign-resources";
import { MediaService } from "../media/media.service";
import { CategoriesService } from "../categories/categories.service";
import { NotificationsService } from "../notifications/notifications.service";
import { randomUUID } from "node:crypto";

type CourseAccess = Awaited<ReturnType<AuthoringRepository["findCourseInstructor"]>>;

/** Maps the fields the course-details form actually submits (see
 *  CourseBuilder's `handleSave`) to the label used in the instructor's
 *  change notification. */
const COURSE_FIELD_LABELS: Record<string, string> = {
  title: "title",
  subtitle: "subtitle",
  description: "description",
  category: "category",
  isoStandard: "ISO standard",
  level: "level",
  thumbnail: "thumbnail",
  basePriceCents: "price",
  visibility: "visibility",
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

@Injectable()
export class AuthoringService {
  constructor(
    private readonly repo: AuthoringRepository,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly categories: CategoriesService,
    private readonly media: MediaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── ownership ──────────────────────────────────────────────────────────
  private async assertCourseAccess(courseId: string, user: RequestUser) {
    const course = await this.repo.findCourseInstructor(courseId);
    if (!course) throw new NotFoundException("Course not found");
    if (user.role !== "ADMIN" && course.instructorId !== user.id)
      throw new ForbiddenException("Not your course");
    return course;
  }

  // ── admin-edit notifications ──────────────────────────────────────────
  /** An admin acting on a course they don't own — the case this whole
   *  section exists to notify the instructor about. */
  private isAdminEditingOthersCourse(user: RequestUser, course: CourseAccess): boolean {
    return user.role === "ADMIN" && !!course && course.instructorId !== user.id;
  }

  /** Field-level "what changed" for the course-details form: compares the
   *  submitted input against the row fetched by `assertCourseAccess` just
   *  before the write. Cheap because that row is already in hand — no extra
   *  query — and it naturally comes out empty (no notification) if an admin
   *  opens the editor and saves without changing anything, since the form
   *  always submits the full field set. */
  private diffCourseFields(prior: CourseAccess, input: UpdateCourseInput): string[] {
    if (!prior) return [];
    const changed: string[] = [];
    for (const [key, label] of Object.entries(COURSE_FIELD_LABELS)) {
      if (!(key in input)) continue;
      const next = (input as Record<string, unknown>)[key];
      const before = (prior as unknown as Record<string, unknown>)[key];
      if (JSON.stringify(next) !== JSON.stringify(before)) changed.push(label);
    }
    return changed;
  }

  private sectionChanged(
    prior: Awaited<ReturnType<AuthoringRepository["findSectionForDiff"]>>,
    input: SectionInput,
  ): boolean {
    if (!prior) return false;
    return prior.title !== input.title || (input.order !== undefined && prior.order !== input.order);
  }

  private lessonChanged(
    prior: Awaited<ReturnType<AuthoringRepository["findLessonForDiff"]>>,
    input: LessonInput,
  ): boolean {
    if (!prior) return false;
    return (
      prior.title !== input.title ||
      prior.type !== input.type ||
      prior.durationSec !== input.durationSec ||
      prior.preview !== input.preview ||
      (input.order !== undefined && prior.order !== input.order) ||
      (input.articleContent !== undefined && prior.articleContent !== (input.articleContent ?? null)) ||
      (input.cfVideoUid !== undefined && prior.cfVideoUid !== (input.cfVideoUid ?? null))
    );
  }

  private notifyInstructorOfAdminChange(
    course: CourseAccess,
    courseId: string,
    summary: string,
    href = `/instructor/courses/${courseId}/edit`,
  ): void {
    if (!course) return;
    void this.notifications
      .notify({
        userId: course.instructorId,
        event: "COURSE_UPDATED_BY_ADMIN",
        title: "Course updated by admin",
        body: `An admin ${summary} on "${course.title}".`,
        href,
        skipEmail: true,
      })
      .catch(() => undefined);
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
      .then((row) =>
        toCourseDetail(row, {
          includeArticleContent: true,
          includeLessonResources: true,
        }),
      )
      // Owner builder needs working download links to preview attachments,
      // same as the enrolled learner view — sign every uploaded resource.
      .then((detail) => signCourseResourceUrls(detail, this.storage));
  }

  /** Owner-gated detail so the course builder can edit drafts. */
  async ownerDetail(user: RequestUser, id: string) {
    await this.assertCourseAccess(id, user);
    return this.detail(id);
  }

  // ── courses ────────────────────────────────────────────────────────────
  async create(user: RequestUser, input: CreateCourseInput) {
    const category = await this.categories.ensureForAuthor(input.category, user);
    const slug = await this.uniqueSlug(input.slug ?? slugify(input.title));
    const course = await this.repo.createCourse({
      courseNumber: `CRS-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
      slug,
      title: input.title,
      subtitle: input.subtitle,
      description: input.description,
      category,
      isoStandard: input.isoStandard,
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
    const course = await this.assertCourseAccess(id, user);
    if (input.visibility !== undefined) {
      // Which orgs a course is assigned to is a platform-admin distribution
      // decision (see OrganizationsService.assertPlatformAdmin) — visibility
      // gets the same restriction, for the same reason: a customer's own
      // instructor shouldn't be able to pull a course out of (or into) the
      // public catalog unilaterally.
      if (user.role !== "ADMIN")
        throw new ForbiddenException(
          "Course visibility is managed by SkillStream — contact support",
        );
      if (input.visibility === "PRIVATE" && course.status !== "PUBLISHED")
        throw new BadRequestException("Publish this course before making it private");
      if (input.visibility === "PUBLIC" && (await this.repo.countOrgAssignments(id)) > 0)
        throw new BadRequestException(
          "Unassign this course from its organization(s) before making it public",
        );
    }
    const category = input.category
      ? await this.categories.ensureForAuthor(input.category, user)
      : undefined;
    const changedFields = this.isAdminEditingOthersCourse(user, course)
      ? this.diffCourseFields(course, input)
      : [];
    await this.repo.updateCourse(id, {
      ...input,
      ...(category ? { category } : {}),
      originalPriceCents: input.originalPriceCents ?? undefined,
    });
    if (changedFields.length) {
      this.notifyInstructorOfAdminChange(course, id, `updated the ${changedFields.join(", ")}`);
    }
    return this.detail(id);
  }

  async setStatus(user: RequestUser, id: string, input: CourseStatusInput) {
    const course = await this.assertCourseAccess(id, user);
    await this.validateStatusChange(course, id, input.status);
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
    if (this.isAdminEditingOthersCourse(user, course) && input.status !== course.status) {
      this.notifyInstructorOfAdminChange(course, id, `changed the status to ${input.status}`);
    }
    return this.detail(id);
  }

  /** Validate without changing data so the builder can fail before saving fields. */
  async validateStatus(user: RequestUser, id: string, input: CourseStatusInput) {
    const course = await this.assertCourseAccess(id, user);
    await this.validateStatusChange(course, id, input.status);
    return { ok: true as const };
  }

  private async validateStatusChange(
    course: { category: string },
    id: string,
    status: CourseStatusInput["status"],
  ) {
    if (status === "PUBLISHED") {
      await this.categories.assertActive(course.category);
      const lessons = await this.repo.findLessonsForPublishValidation(id);
      if (lessons.length === 0)
        throw new BadRequestException("Add at least one lesson before publishing this course");

      const incomplete = lessons.filter((lesson) => {
        const hasResource = parseLessonResources(lesson.resources).length > 0;
        if (lesson.type === "VIDEO") return !lesson.cfVideoUid;
        if (lesson.type === "QUIZ") {
          return !lesson.quiz?.questions.some(
            (question) =>
              question.prompt.trim().length > 0 &&
              question.options.filter((option) => option.text.trim()).length >= 2 &&
              question.options.some((option) => option.text.trim() && option.isCorrect),
          );
        }
        return !(lesson.articleContent?.trim() || hasResource);
      });
      if (incomplete.length > 0)
        throw new BadRequestException(
          `Complete all lessons before publishing. ${incomplete.length} lesson${incomplete.length === 1 ? "" : "s"} still needs content.`,
        );
    }
    if (status !== "PUBLISHED" && (await this.repo.countOrgAssignments(id)) > 0)
      throw new BadRequestException(
        "Unassign this course from its organization(s) before unpublishing it",
      );
  }

  async remove(user: RequestUser, id: string) {
    const course = await this.assertCourseAccess(id, user);
    const videoLessons = await this.repo.findCfVideoUidsByCourse(id);
    await this.repo.deleteCourse(id);
    await this.releaseLessonVideoUids(videoLessons);
    if (this.isAdminEditingOthersCourse(user, course)) {
      // The edit page is gone along with the course — send the instructor to
      // their course list instead of a link that would 404.
      this.notifyInstructorOfAdminChange(course, id, "deleted your course", "/instructor/courses");
    }
    return { ok: true as const };
  }

  private async releaseLessonVideoUids(
    rows: { cfVideoUid: string | null }[],
  ): Promise<void> {
    const uids = [
      ...new Set(
        rows.map((row) => row.cfVideoUid).filter((uid): uid is string => !!uid),
      ),
    ];
    await Promise.all(uids.map((uid) => this.media.onCloudflareUidReleased(uid)));
  }

  async myCourses(user: RequestUser) {
    const rows = await this.repo.findManyCoursesByInstructor(user.id);
    // Owners also get their own revenue figure (not part of the public summary).
    return rows.map((r) => ({ ...toCourseSummary(r), revenueCents: r.revenueCents }));
  }

  // ── sections ───────────────────────────────────────────────────────────
  async addSection(user: RequestUser, courseId: string, input: SectionInput) {
    const course = await this.assertCourseAccess(courseId, user);
    const count = await this.repo.countSections(courseId);
    await this.repo.createSection({
      courseId,
      title: input.title,
      order: input.order ?? count,
    });
    if (this.isAdminEditingOthersCourse(user, course)) {
      this.notifyInstructorOfAdminChange(course, courseId, "added a section");
    }
    return this.detail(courseId);
  }

  async updateSection(user: RequestUser, sectionId: string, input: SectionInput) {
    const courseId = await this.courseIdOfSection(sectionId);
    const course = await this.assertCourseAccess(courseId, user);
    const notifyAdminEdit = this.isAdminEditingOthersCourse(user, course);
    // The builder resends every section unconditionally on each Save — only
    // fetch the prior row (and only notify) when it's actually worth diffing.
    const prior = notifyAdminEdit ? await this.repo.findSectionForDiff(sectionId) : null;
    await this.repo.updateSection(sectionId, {
      title: input.title,
      order: input.order,
    });
    if (notifyAdminEdit && this.sectionChanged(prior, input)) {
      this.notifyInstructorOfAdminChange(course, courseId, "updated a section");
    }
    return this.detail(courseId);
  }

  async removeSection(user: RequestUser, sectionId: string) {
    const courseId = await this.courseIdOfSection(sectionId);
    const course = await this.assertCourseAccess(courseId, user);
    const videoLessons = await this.repo.findCfVideoUidsBySection(sectionId);
    await this.repo.deleteSection(sectionId);
    await this.releaseLessonVideoUids(videoLessons);
    if (this.isAdminEditingOthersCourse(user, course)) {
      this.notifyInstructorOfAdminChange(course, courseId, "removed a section");
    }
    return this.detail(courseId);
  }

  // ── lessons ────────────────────────────────────────────────────────────
  async addLesson(user: RequestUser, sectionId: string, input: LessonInput) {
    const courseId = await this.courseIdOfSection(sectionId);
    const course = await this.assertCourseAccess(courseId, user);
    if (input.cfVideoUid) {
      await this.media.assertAttachableUpload({
        uid: input.cfVideoUid,
        userId: user.id,
        courseId,
      });
    }
    const count = await this.repo.countLessons(sectionId);
    const lesson = await this.repo.createLesson({
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
    if (input.cfVideoUid) {
      await this.media.attachUploadToLesson(input.cfVideoUid, lesson.id, courseId);
    }
    if (this.isAdminEditingOthersCourse(user, course)) {
      this.notifyInstructorOfAdminChange(course, courseId, "added a lesson");
    }
    return this.detail(courseId);
  }

  async updateLesson(user: RequestUser, lessonId: string, input: LessonInput) {
    const courseId = await this.courseIdOfLesson(lessonId);
    const course = await this.assertCourseAccess(courseId, user);
    const notifyAdminEdit = this.isAdminEditingOthersCourse(user, course);
    // Same reasoning as updateSection: the builder resends every lesson
    // unconditionally on each Save, so only diff (and only notify) when it's
    // actually an admin editing someone else's course.
    const priorLesson = notifyAdminEdit ? await this.repo.findLessonForDiff(lessonId) : null;

    const priorVideo = await this.repo.findLessonCfVideoUid(lessonId);
    const priorUid = priorVideo?.cfVideoUid ?? null;

    if (input.cfVideoUid) {
      if (input.cfVideoUid !== priorUid) {
        await this.media.assertAttachableUpload({
          uid: input.cfVideoUid,
          userId: user.id,
          courseId,
          lessonId,
        });
      }
    }

    // If the caller sent a new `resources` array, any previously-uploaded
    // resource (has `storageKey`) that no longer appears has been removed —
    // best-effort delete from storage so we don't leak orphan objects.
    let removedKeys: string[] = [];
    if (input.resources !== undefined) {
      const before = await this.repo.findLessonResources(lessonId);
      if (before) {
        const priorResources = parseLessonResources(before.resources);
        const nextKeys = new Set(
          (input.resources ?? [])
            .map((r) => r.storageKey)
            .filter((k): k is string => !!k),
        );
        removedKeys = priorResources
          .map((r) => r.storageKey)
          .filter((k): k is string => !!k && !nextKeys.has(k));
      }
    }

    const releasedUid = await this.repo.runTransaction(async (tx) => {
      let released: string | null = null;

      if (input.cfVideoUid !== undefined) {
        const replacing = !!input.cfVideoUid && input.cfVideoUid !== priorUid;
        const clearing = !input.cfVideoUid && !!priorUid;
        if ((replacing || clearing) && priorUid) {
          await this.media.detachUploadFromLesson(priorUid, tx);
          released = priorUid;
        }
      }

      await this.repo.updateLesson(
        lessonId,
        {
          title: input.title,
          type: input.type,
          durationSec: input.durationSec,
          preview: input.preview,
          order: input.order,
          articleContent: input.articleContent ?? undefined,
          cfVideoUid: input.cfVideoUid ?? undefined,
          resources: input.resources ?? undefined,
        },
        tx,
      );

      if (
        input.cfVideoUid !== undefined &&
        input.cfVideoUid &&
        input.cfVideoUid !== priorUid
      ) {
        await this.media.attachUploadToLesson(
          input.cfVideoUid,
          lessonId,
          courseId,
          tx,
        );
      }

      return released;
    });

    if (releasedUid) {
      await this.media.onCloudflareUidReleased(releasedUid);
    }

    // Post-commit: DB is authoritative, so a failed storage delete just leaks
    // an object — never blocks the API response.
    await Promise.all(
      removedKeys.map((k) => this.storage.delete(k).catch(() => undefined)),
    );

    if (notifyAdminEdit && this.lessonChanged(priorLesson, input)) {
      this.notifyInstructorOfAdminChange(course, courseId, "updated a lesson");
    }
    return this.detail(courseId);
  }

  async removeLesson(user: RequestUser, lessonId: string) {
    const courseId = await this.courseIdOfLesson(lessonId);
    const course = await this.assertCourseAccess(courseId, user);
    const priorVideo = await this.repo.findLessonCfVideoUid(lessonId);
    const priorUid = priorVideo?.cfVideoUid ?? null;
    // Collect uploaded resource keys BEFORE the row cascades away so we can
    // clean up bucket objects — Prisma won't tell us the JSON contents after.
    const before = await this.repo.findLessonResources(lessonId);
    const keys = before
      ? parseLessonResources(before.resources)
          .map((r) => r.storageKey)
          .filter((k): k is string => !!k)
      : [];
    await this.repo.deleteLesson(lessonId);
    if (priorUid) {
      await this.media.onCloudflareUidReleased(priorUid);
    }
    await Promise.all(
      keys.map((k) => this.storage.delete(k).catch(() => undefined)),
    );
    if (this.isAdminEditingOthersCourse(user, course)) {
      this.notifyInstructorOfAdminChange(course, courseId, "removed a lesson");
    }
    return this.detail(courseId);
  }

  // ── reorder ────────────────────────────────────────────────────────────
  async reorderSections(user: RequestUser, courseId: string, ids: string[]) {
    const course = await this.assertCourseAccess(courseId, user);
    await this.repo.reorderSections(ids);
    if (this.isAdminEditingOthersCourse(user, course)) {
      this.notifyInstructorOfAdminChange(course, courseId, "reordered the curriculum");
    }
    return this.detail(courseId);
  }

  async reorderLessons(user: RequestUser, sectionId: string, ids: string[]) {
    const courseId = await this.courseIdOfSection(sectionId);
    const course = await this.assertCourseAccess(courseId, user);
    await this.repo.reorderLessons(ids);
    if (this.isAdminEditingOthersCourse(user, course)) {
      this.notifyInstructorOfAdminChange(course, courseId, "reordered the curriculum");
    }
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
