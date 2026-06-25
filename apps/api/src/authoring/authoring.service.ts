import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateCourseInput,
  CourseStatusInput,
  LessonInput,
  SectionInput,
  UpdateCourseInput,
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
      .then(toCourseDetail);
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
    await this.prisma.course.update({
      where: { id },
      data: {
        status: input.status,
        publishedAt: input.status === "PUBLISHED" ? new Date() : undefined,
      },
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
    return rows.map(toCourseSummary);
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
}
