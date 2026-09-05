import { Prisma } from "@prisma/client";
import type { ConfigService } from "@nestjs/config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminAlertsService } from "../../email/admin-alerts.service";
import type { NotificationsService } from "../../notifications/notifications.service";
import type { Env } from "../../../config/env";
import type { PrismaService } from "../../../prisma/prisma.service";
import { EnrollmentService } from "../enrollment.service";
import type { EnrollmentRepository } from "../enrollment.repository";

const userId = "user_1";
const courseId = "course_1";
const enrollmentId = "enroll_1";
const lesson1 = "lesson_1";
const lesson2 = "lesson_2";
const issuedAt = new Date("2026-09-01T12:00:00.000Z");

const certRow = {
  id: "cert_1",
  enrollmentId,
  serial: "CERT-ABC123DEF456",
  learnerName: "Ada Lovelace",
  pdfUrl: null,
  issuedAt,
};

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("unique", {
    code: "P2002",
    clientVersion: "6",
  });
}

function lessonAccessContext(orderedLessonIds: string[], targetLessonId: string) {
  return {
    id: targetLessonId,
    section: {
      courseId,
      course: {
        visibility: "PUBLIC" as const,
        orgId: null,
        org: null,
        sections: [
          {
            lessons: orderedLessonIds.map((id) => ({ id })),
          },
        ],
      },
    },
  };
}

function makeService(overrides: {
  repo?: Partial<EnrollmentRepository>;
  prisma?: Partial<PrismaService>;
  notifications?: Partial<NotificationsService>;
}) {
  const repo = {
    findIdByUserAndCourse: vi.fn().mockResolvedValue({ id: enrollmentId }),
    findLessonCourseId: vi
      .fn()
      .mockResolvedValue({ section: { courseId } }),
    findLessonAccessContext: vi.fn(),
    findCompletedLessonIds: vi.fn(),
    findLessonProgress: vi.fn(),
    deleteLessonProgressById: vi.fn().mockResolvedValue(undefined),
    createLessonProgress: vi.fn().mockResolvedValue(undefined),
    upsertLessonProgress: vi.fn().mockResolvedValue(undefined),
    countLessonsAndCompleted: vi.fn(),
    updateEnrollment: vi.fn().mockResolvedValue(undefined),
    findCertificateByEnrollment: vi.fn(),
    findUserName: vi.fn().mockResolvedValue({ name: certRow.learnerName }),
    createCertificate: vi.fn(),
    ...overrides.repo,
  } as unknown as EnrollmentRepository;

  const prisma = {
    $transaction: vi.fn(async (fn: (tx: object) => Promise<unknown>) => fn({})),
    ...overrides.prisma,
  } as unknown as PrismaService;

  const notifications = {
    notify: vi.fn().mockResolvedValue(undefined),
    notifyEmailAfterCommit: vi.fn().mockResolvedValue(undefined),
    ...overrides.notifications,
  } as unknown as NotificationsService;

  const config = {
    get: vi.fn((key: keyof Env) => {
      if (key === "API_BASE_URL") return "https://api.example";
      return undefined;
    }),
  } as unknown as ConfigService<Env, true>;

  const alerts = {} as AdminAlertsService;

  const service = new EnrollmentService(repo, prisma, config, alerts, notifications);

  return { service, repo, prisma, notifications };
}

function mockSequentialAccess(repo: EnrollmentRepository, completedBefore: string[]) {
  vi.mocked(repo.findLessonAccessContext).mockImplementation(async (lessonId) =>
    lessonAccessContext([lesson1, lesson2], lessonId),
  );
  vi.mocked(repo.findCompletedLessonIds).mockResolvedValue(
    completedBefore.map((lessonId) => ({ lessonId })),
  );
}

describe("EnrollmentService certificate persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("issues a certificate on first completion with transactional notify and post-commit email", async () => {
    const { service, repo, prisma, notifications } = makeService({});
    mockSequentialAccess(repo, [lesson1]);
    vi.mocked(repo.findLessonProgress).mockResolvedValue(null);
    vi.mocked(repo.countLessonsAndCompleted).mockResolvedValue([2, 2]);
    vi.mocked(repo.findCertificateByEnrollment).mockResolvedValue(null);
    vi.mocked(repo.createCertificate).mockResolvedValue(certRow);

    const result = await service.toggleLesson(userId, courseId, lesson2);

    expect(result.courseCompleted).toBe(true);
    expect(result.certificate).toMatchObject({
      serial: certRow.serial,
      learnerName: certRow.learnerName,
      issuedAt: issuedAt.toISOString(),
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ event: "CERTIFICATE_ISSUED", userId }),
      {},
    );
    expect(notifications.notifyEmailAfterCommit).toHaveBeenCalledTimes(1);
    expect(repo.createCertificate).toHaveBeenCalledTimes(1);
  });

  it("returns an existing certificate on P2002 enrollment race without notifying", async () => {
    const { service, repo, prisma, notifications } = makeService({
      prisma: {
        $transaction: vi.fn().mockRejectedValue(p2002()),
      },
    });
    mockSequentialAccess(repo, [lesson1]);
    vi.mocked(repo.findLessonProgress).mockResolvedValue(null);
    vi.mocked(repo.countLessonsAndCompleted).mockResolvedValue([2, 2]);
    vi.mocked(repo.findCertificateByEnrollment)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(certRow);

    const result = await service.toggleLesson(userId, courseId, lesson2);

    expect(result.certificate).toMatchObject({
      serial: certRow.serial,
      learnerName: certRow.learnerName,
      issuedAt: issuedAt.toISOString(),
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.notifyEmailAfterCommit).not.toHaveBeenCalled();
    expect(repo.createCertificate).not.toHaveBeenCalled();
  });

  it("retries with a new serial on P2002 serial collision", async () => {
    const created = { ...certRow, serial: "CERT-NEW000000001" };
    const { service, repo, prisma, notifications } = makeService({
      prisma: {
        $transaction: vi
          .fn()
          .mockRejectedValueOnce(p2002())
          .mockImplementationOnce(async (fn: (tx: object) => Promise<unknown>) => fn({})),
      },
    });
    mockSequentialAccess(repo, [lesson1]);
    vi.mocked(repo.findLessonProgress).mockResolvedValue(null);
    vi.mocked(repo.countLessonsAndCompleted).mockResolvedValue([2, 2]);
    vi.mocked(repo.findCertificateByEnrollment)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    vi.mocked(repo.createCertificate).mockResolvedValue(created);

    const result = await service.toggleLesson(userId, courseId, lesson2);

    expect(result.certificate?.serial).toBe("CERT-NEW000000001");
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notifyEmailAfterCommit).toHaveBeenCalledTimes(1);
  });

  it("does not re-notify when a certificate already exists on re-completion", async () => {
    const { service, repo, notifications } = makeService({});
    mockSequentialAccess(repo, [lesson1]);
    vi.mocked(repo.findLessonProgress).mockResolvedValue(null);
    vi.mocked(repo.countLessonsAndCompleted).mockResolvedValue([2, 2]);
    vi.mocked(repo.findCertificateByEnrollment).mockResolvedValue(certRow);

    const result = await service.toggleLesson(userId, courseId, lesson2);

    expect(result.certificate).toMatchObject({
      serial: certRow.serial,
      learnerName: certRow.learnerName,
      issuedAt: issuedAt.toISOString(),
    });
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.notifyEmailAfterCommit).not.toHaveBeenCalled();
    expect(repo.createCertificate).not.toHaveBeenCalled();
  });

  it("keeps the certificate when a completed lesson is un-completed", async () => {
    const { service, repo, notifications } = makeService({});
    mockSequentialAccess(repo, [lesson1]);
    vi.mocked(repo.findLessonProgress).mockResolvedValue({
      id: "progress_2",
      enrollmentId,
      lessonId: lesson2,
      completed: true,
      completedAt: issuedAt,
      watchTimeSec: 0,
    });
    vi.mocked(repo.countLessonsAndCompleted).mockResolvedValue([2, 1]);
    vi.mocked(repo.findCertificateByEnrollment).mockResolvedValue(certRow);

    const result = await service.toggleLesson(userId, courseId, lesson2);

    expect(result.courseCompleted).toBe(false);
    expect(result.certificate).toMatchObject({
      serial: certRow.serial,
      learnerName: certRow.learnerName,
      issuedAt: issuedAt.toISOString(),
    });
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(repo.createCertificate).not.toHaveBeenCalled();
  });

  it("returns no certificate when un-completing before one was ever issued", async () => {
    const { service, repo } = makeService({});
    mockSequentialAccess(repo, []);
    vi.mocked(repo.findLessonProgress).mockResolvedValue({
      id: "progress_1",
      enrollmentId,
      lessonId: lesson1,
      completed: true,
      completedAt: issuedAt,
      watchTimeSec: 0,
    });
    vi.mocked(repo.countLessonsAndCompleted).mockResolvedValue([2, 0]);
    vi.mocked(repo.findCertificateByEnrollment).mockResolvedValue(null);

    const result = await service.toggleLesson(userId, courseId, lesson1);

    expect(result.certificate).toBeNull();
  });

  it("markLessonComplete returns without re-notifying when a certificate exists", async () => {
    const { service, repo, notifications } = makeService({});
    mockSequentialAccess(repo, [lesson1]);
    vi.mocked(repo.countLessonsAndCompleted).mockResolvedValue([2, 2]);
    vi.mocked(repo.findCertificateByEnrollment).mockResolvedValue(certRow);

    await service.markLessonComplete(userId, courseId, lesson2);

    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.notifyEmailAfterCommit).not.toHaveBeenCalled();
    expect(repo.createCertificate).not.toHaveBeenCalled();
  });
});
