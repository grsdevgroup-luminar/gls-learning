import type { ConfigService } from "@nestjs/config";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    findLessonProgress: vi.fn(),
    uncompleteLessonProgress: vi.fn().mockResolvedValue(undefined),
    upsertLessonProgress: vi.fn().mockResolvedValue(undefined),
    countLessonsAndCompleted: vi.fn().mockResolvedValue([2, 1]),
    updateEnrollment: vi.fn().mockResolvedValue(undefined),
    findCertificateByEnrollment: vi.fn().mockResolvedValue(null),
    findByUserAndCourse: vi.fn(),
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
          lessons: [{ durationSec: 600 }, { durationSec: 120 }],
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
          lesson: { durationSec: 600 },
        },
        {
          lessonId: lesson2,
          completed: false,
          lesson: { durationSec: 120 },
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
    vi.mocked(repo.findLessonProgress).mockResolvedValue({
      id: "progress_2",
      enrollmentId,
      lessonId: lesson2,
      completed: false,
      completedAt: new Date(),
    });
    vi.mocked(repo.findCompletedLessonIds).mockResolvedValue([
      { lessonId: lesson1 },
      { lessonId: lesson2 },
    ]);

    const result = await service.toggleLesson(userId, courseId, lesson2);

    expect(result.completed).toBe(true);
    expect(repo.upsertLessonProgress).toHaveBeenCalledWith(enrollmentId, lesson2);
    expect(repo.uncompleteLessonProgress).not.toHaveBeenCalled();
  });
});
