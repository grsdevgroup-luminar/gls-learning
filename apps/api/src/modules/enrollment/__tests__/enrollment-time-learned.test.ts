import type { ConfigService } from "@nestjs/config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { AdminAlertsService } from "../../email/admin-alerts.service";
import type { NotificationsService } from "../../notifications/notifications.service";
import type { Env } from "../../../config/env";
import type { PrismaService } from "../../../prisma/prisma.service";
import { EnrollmentService } from "../enrollment.service";
import type { EnrollmentRepository, EnrollmentRow } from "../enrollment.repository";

const userId = "user_1";
const courseId = "course_1";
const enrollmentId = "enroll_1";
const lesson1 = "lesson_1";
const lesson2 = "lesson_2";

function lessonAccessContext(orderedLessonIds: string[], targetLessonId: string) {
  return {
    id: targetLessonId,
    section: {
      courseId,
      course: {
        visibility: "PUBLIC" as const,
        orgAssignments: [] as {
          org: {
            id: string;
            status: string;
            accessLocksAt: Date | null;
            members: { id: string }[];
          };
        }[],
        sections: [{ lessons: orderedLessonIds.map((id) => ({ id })) }],
      },
    },
  };
}

function makeService(repoOverrides: Partial<EnrollmentRepository> = {}) {
  const repo = {
    findIdByUserAndCourse: vi.fn().mockResolvedValue({ id: enrollmentId }),
    findLessonCourseId: vi.fn().mockResolvedValue({ section: { courseId } }),
    findLessonAccessContext: vi.fn().mockImplementation(async (lessonId: string) =>
      lessonAccessContext([lesson1, lesson2], lessonId),
    ),
    findCompletedLessonIds: vi.fn().mockResolvedValue([{ lessonId: lesson1 }]),
    findPassedQuizLessons: vi.fn().mockResolvedValue([]),
    findLessonProgress: vi.fn(),
    uncompleteLessonProgress: vi.fn().mockResolvedValue(undefined),
    upsertLessonProgress: vi.fn().mockResolvedValue(undefined),
    countLessonsAndCompleted: vi.fn().mockResolvedValue([2, 1]),
    updateEnrollment: vi.fn().mockResolvedValue(undefined),
    findCertificateByEnrollment: vi.fn().mockResolvedValue(null),
    findUserName: vi.fn().mockResolvedValue(null),
    findCourseNumber: vi.fn().mockResolvedValue(null),
    findByUserAndCourse: vi.fn(),
    findCourseAccessContext: vi.fn().mockResolvedValue({
      visibility: "PUBLIC",
      basePriceCents: 0,
      orgAssignments: [],
      deliveryPartnerAssignments: [],
    }),
    hasUnrefundedPurchase: vi.fn().mockResolvedValue(false),
    ...repoOverrides,
  } as unknown as EnrollmentRepository;

  const config = {
    get: vi.fn((key: keyof Env) =>
      key === "API_BASE_URL" ? "https://api.example" : undefined,
    ),
  } as unknown as ConfigService<Env, true>;

  const service = new EnrollmentService(
    repo,
    {} as PrismaService,
    config,
    {} as AdminAlertsService,
    {
      notify: vi.fn(),
      notifyEmailAfterCommit: vi.fn(),
    } as unknown as NotificationsService,
    { hasPendingRoleApplication: vi.fn().mockResolvedValue(false) } as never,
  );

  return { service, repo };
}

function enrollmentRow(
  lessonProgress: EnrollmentRow["lessonProgress"],
): EnrollmentRow {
  const now = new Date("2026-09-01T12:00:00.000Z");
  return {
    id: enrollmentId,
    userId,
    courseId,
    status: "IN_PROGRESS",
    watchTimeSec: 0,
    enrolledAt: now,
    lastActivityAt: now,
    completedAt: null,
    certificate: null,
    lessonProgress,
    course: {
      id: courseId,
      courseNumber: "C-1",
      slug: "course",
      title: "Course",
      subtitle: "",
      category: "Dev",
      isoStandard: "ISO-1",
      updatedAt: now,
      level: "BEGINNER",
      thumbnail: "",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      bestseller: false,
      language: "en",
      basePriceCents: 0,
      originalPriceCents: null,
      ratingAvg: 0,
      reviewCount: 0,
      studentCount: 0,
      sections: [
        {
          lessons: [{ id: lesson1, durationSec: 600 }, { id: lesson2, durationSec: 120 }],
        },
      ],
      instructor: {
        id: "instr_1",
        name: "Ada",
        avatar: null,
        instructorProfile: null,
      },
    },
  } as unknown as EnrollmentRow;
}

describe("EnrollmentService time learned persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("credits duration for lessons that were later unchecked", async () => {
    const { service, repo } = makeService();
    vi.mocked(repo.findByUserAndCourse).mockResolvedValue(
      enrollmentRow([
        {
          lessonId: lesson1,
          completed: true,
          completedAt: new Date("2026-09-01T12:00:00.000Z"),
          lesson: { durationSec: 600, type: "ARTICLE" },
        },
        {
          lessonId: lesson2,
          completed: false,
          // Unchecked, but completedAt is retained (see toDto's comment) —
          // its duration still counts toward lifetime time learned.
          completedAt: new Date("2026-09-01T12:00:00.000Z"),
          lesson: { durationSec: 120, type: "ARTICLE" },
        },
      ]),
    );

    const dto = await service.getOne(userId, courseId);

    expect(dto.timeLearnedSec).toBe(720);
    expect(dto.completedLessonIds).toEqual([lesson1]);
    expect(dto.completedCount).toBe(1);
    expect(dto.progressPct).toBe(50);
  });

  it("un-completes by flipping the row, not deleting it", async () => {
    const { service, repo } = makeService();
    vi.mocked(repo.findLessonProgress).mockResolvedValue({
      id: "progress_1",
      enrollmentId,
      lessonId: lesson1,
      completed: true,
      completedAt: new Date(),
    });

    const result = await service.toggleLesson(userId, courseId, lesson1);

    expect(result.completed).toBe(false);
    expect(repo.uncompleteLessonProgress).toHaveBeenCalledWith("progress_1");
    expect(repo.upsertLessonProgress).not.toHaveBeenCalled();
  });

  it("re-completing an unchecked lesson upserts instead of treating it as a first complete", async () => {
    const { service, repo } = makeService();
    vi.mocked(repo.findCompletedLessonIds)
      .mockResolvedValueOnce([{ lessonId: lesson1 }] as never)
      .mockResolvedValue([{ lessonId: lesson1 }, { lessonId: lesson2 }] as never);
    vi.mocked(repo.findLessonProgress).mockResolvedValue({
      id: "progress_2",
      enrollmentId,
      lessonId: lesson2,
      completed: false,
      completedAt: new Date(),
    });
    const result = await service.toggleLesson(userId, courseId, lesson2);

    expect(result.completed).toBe(true);
    expect(repo.upsertLessonProgress).toHaveBeenCalledWith(enrollmentId, lesson2);
    expect(repo.uncompleteLessonProgress).not.toHaveBeenCalled();
  });
});

describe("quiz lesson access", () => {
  it("rejects manual completion of a quiz", async () => {
    const { service, repo } = makeService({
      findLessonCourseId: vi.fn().mockResolvedValue({ type: "QUIZ", section: { courseId } }) as never,
    });

    await expect(service.toggleLesson(userId, courseId, lesson1))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(repo.upsertLessonProgress).not.toHaveBeenCalled();
  });

  it("ignores a legacy quiz progress flag until a passing result exists", async () => {
    const { service, repo } = makeService();
    vi.mocked(repo.findCompletedLessonIds).mockResolvedValue([
      { lessonId: lesson1, lesson: { type: "QUIZ" } },
    ] as never);

    await expect(service.assertLessonAccessible(userId, lesson2))
      .rejects.toBeInstanceOf(ForbiddenException);

    vi.mocked(repo.findPassedQuizLessons).mockResolvedValue([
      { lessonId: lesson1, lesson: { section: { courseId } } },
    ] as never);
    await expect(service.assertLessonAccessible(userId, lesson2)).resolves.toBeUndefined();
  });

  it("does not show a legacy quiz flag as course completion", async () => {
    const { service, repo } = makeService();
    const laterLessonId = "lesson_3";
    const row = enrollmentRow([
      { lessonId: lesson1, completed: true, completedAt: new Date(), lesson: { durationSec: 600, type: "ARTICLE" } },
      { lessonId: lesson2, completed: true, completedAt: new Date(), lesson: { durationSec: 120, type: "QUIZ" } },
      { lessonId: laterLessonId, completed: true, completedAt: new Date(), lesson: { durationSec: 120, type: "ARTICLE" } },
    ] as never);
    row.status = "COMPLETED";
    row.course.sections[0].lessons = [
      { id: lesson1, type: "ARTICLE", durationSec: 600 },
      { id: lesson2, type: "QUIZ", durationSec: 120 },
      { id: laterLessonId, type: "ARTICLE", durationSec: 120 },
    ];
    vi.mocked(repo.findByUserAndCourse).mockResolvedValue(row);

    const dto = await service.getOne(userId, courseId);
    expect(dto.completedLessonIds).toEqual([lesson1]);
    expect(dto.completedCount).toBe(1);
    expect(dto.status).toBe("IN_PROGRESS");
  });
});
