import type { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import type { AdminAlertsService } from "../../email/admin-alerts.service";
import type { NotificationsService } from "../../notifications/notifications.service";
import type { Env } from "../../../config/env";
import type { PrismaService } from "../../../prisma/prisma.service";
import { EnrollmentService } from "../enrollment.service";
import type { EnrollmentRepository } from "../enrollment.repository";

const userId = "user_1";
const courseId = "course_1";
const lessonId = "lesson_1";

function makeService(repoOverrides: Partial<EnrollmentRepository>) {
  const repo = { ...repoOverrides } as unknown as EnrollmentRepository;
  const config = { get: vi.fn() } as unknown as ConfigService<Env, true>;
  const alerts = {} as AdminAlertsService;
  const notifications = {} as NotificationsService;
  const prisma = {} as PrismaService;
  return new EnrollmentService(repo, prisma, config, alerts, notifications);
}

/** A "member" org row shaped as `findCourseAccess`/`findLessonAccessContext`
 *  return it — `members` non-empty means the calling user belongs to it. */
function memberOrg(id: string, status: string, accessLocksAt: Date | null = null) {
  return { org: { id, status, accessLocksAt, members: [{ id: "member_1" }] } };
}
function nonMemberOrg(id: string, status: string) {
  return { org: { id, status, accessLocksAt: null, members: [] as { id: string }[] } };
}

describe("EnrollmentService org-suspension gating", () => {
  describe("enrollFree", () => {
    it("blocks a new enrollment immediately once the org is suspended, mode-agnostic", async () => {
      const service = makeService({
        findCourseAccess: vi.fn().mockResolvedValue({
          basePriceCents: 0,
          status: "PUBLISHED",
          visibility: "PRIVATE",
          orgAssignments: [memberOrg("org_1", "SUSPENDED")],
          deliveryPartnerAssignments: [],
        }),
      });

      await expect(service.enrollFree(userId, courseId)).rejects.toThrow(ForbiddenException);
    });

    it("allows enrollment via a second, active org even if the user's other assigned org is suspended", async () => {
      const service = makeService({
        findCourseAccess: vi.fn().mockResolvedValue({
          basePriceCents: 0,
          status: "PUBLISHED",
          visibility: "PRIVATE",
          orgAssignments: [
            memberOrg("org_suspended", "SUSPENDED"),
            memberOrg("org_active", "ACTIVE"),
            nonMemberOrg("org_unrelated", "ACTIVE"),
          ],
          deliveryPartnerAssignments: [],
        }),
        findIdByUserAndCourse: vi.fn().mockResolvedValue(null),
        upsertEnrollment: vi.fn().mockResolvedValue(undefined),
        incrementCourseStudentCount: vi
          .fn()
          .mockResolvedValue({ instructorId: "instr_1", title: "Course" }),
        incrementInstructorStudentCount: vi.fn().mockResolvedValue(undefined),
        findUserName: vi.fn().mockResolvedValue({ name: "Ada" }),
        findByUserAndCourse: vi.fn().mockResolvedValue({
          id: "enroll_1",
          courseId,
          status: "IN_PROGRESS",
          watchTimeSec: 0,
          enrolledAt: new Date(),
          lastActivityAt: new Date(),
          completedAt: null,
          course: {
            id: courseId,
            slug: "course",
            title: "Course",
            subtitle: null,
            category: "Dev",
            level: "BEGINNER",
            thumbnail: null,
            status: "PUBLISHED",
            visibility: "PRIVATE",
            bestseller: false,
            language: "en",
            basePriceCents: 0,
            originalPriceCents: null,
            ratingAvg: 0,
            reviewCount: 0,
            studentCount: 0,
            sections: [],
            instructor: { id: "instr_1", name: "Ada", avatar: null, instructorProfile: null },
          },
          lessonProgress: [],
          certificate: null,
        }),
      });

      await expect(service.enrollFree(userId, courseId)).resolves.toMatchObject({ courseId });
    });

    it("rejects a user who isn't a member of any org the course is assigned to", async () => {
      const service = makeService({
        findCourseAccess: vi.fn().mockResolvedValue({
          basePriceCents: 0,
          status: "PUBLISHED",
          visibility: "PRIVATE",
          orgAssignments: [nonMemberOrg("org_1", "ACTIVE")],
          deliveryPartnerAssignments: [],
        }),
      });

      await expect(service.enrollFree(userId, courseId)).rejects.toThrow(ForbiddenException);
    });

    it("is unaffected by a Public course being assigned to a suspended org — enrollment never checks org membership for it", async () => {
      const service = makeService({
        findCourseAccess: vi.fn().mockResolvedValue({
          basePriceCents: 0,
          status: "PUBLISHED",
          visibility: "PUBLIC",
          orgAssignments: [memberOrg("org_1", "SUSPENDED")],
          deliveryPartnerAssignments: [],
        }),
        findIdByUserAndCourse: vi.fn().mockResolvedValue(null),
        upsertEnrollment: vi.fn().mockResolvedValue(undefined),
        incrementCourseStudentCount: vi
          .fn()
          .mockResolvedValue({ instructorId: "instr_1", title: "Course" }),
        incrementInstructorStudentCount: vi.fn().mockResolvedValue(undefined),
        findUserName: vi.fn().mockResolvedValue({ name: "Ada" }),
        findByUserAndCourse: vi.fn().mockResolvedValue({
          id: "enroll_1",
          courseId,
          status: "IN_PROGRESS",
          watchTimeSec: 0,
          enrolledAt: new Date(),
          lastActivityAt: new Date(),
          completedAt: null,
          course: {
            id: courseId,
            slug: "course",
            title: "Course",
            subtitle: null,
            category: "Dev",
            level: "BEGINNER",
            thumbnail: null,
            status: "PUBLISHED",
            visibility: "PUBLIC",
            bestseller: false,
            language: "en",
            basePriceCents: 0,
            originalPriceCents: null,
            ratingAvg: 0,
            reviewCount: 0,
            studentCount: 0,
            sections: [],
            instructor: { id: "instr_1", name: "Ada", avatar: null, instructorProfile: null },
          },
          lessonProgress: [],
          certificate: null,
        }),
      });

      await expect(service.enrollFree(userId, courseId)).resolves.toMatchObject({ courseId });
    });
  });

  describe("assertLessonAccessible", () => {
    function lessonContext(orgAssignments: ReturnType<typeof memberOrg>[], visibility: "PUBLIC" | "PRIVATE" = "PRIVATE") {
      return {
        id: lessonId,
        section: {
          courseId,
          course: {
            visibility,
            basePriceCents: 0,
            orgAssignments,
            deliveryPartnerAssignments: [],
            sections: [{ lessons: [{ id: lessonId }] }],
          },
        },
      };
    }

    it("blocks lesson access once the suspension lock has taken effect", async () => {
      const service = makeService({
        findLessonAccessContext: vi
          .fn()
          .mockResolvedValue(
            lessonContext([memberOrg("org_1", "SUSPENDED", new Date(Date.now() - 1000))]),
          ),
        findIdByUserAndCourse: vi.fn().mockResolvedValue({ id: "enroll_1" }),
      });

      await expect(service.assertLessonAccessible(userId, lessonId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("still allows lesson access during an unexpired grace period", async () => {
      const service = makeService({
        findLessonAccessContext: vi.fn().mockResolvedValue(
          lessonContext([memberOrg("org_1", "SUSPENDED", new Date(Date.now() + 86_400_000))]),
        ),
        findIdByUserAndCourse: vi.fn().mockResolvedValue({ id: "enroll_1" }),
        findCompletedLessonIds: vi.fn().mockResolvedValue([]),
      });

      await expect(service.assertLessonAccessible(userId, lessonId)).resolves.toBeUndefined();
    });

    it("allows access via a second, unlocked org even if another assigned org is locked", async () => {
      const service = makeService({
        findLessonAccessContext: vi.fn().mockResolvedValue(
          lessonContext([
            memberOrg("org_locked", "SUSPENDED", new Date(Date.now() - 1000)),
            memberOrg("org_active", "ACTIVE"),
          ]),
        ),
        findIdByUserAndCourse: vi.fn().mockResolvedValue({ id: "enroll_1" }),
        findCompletedLessonIds: vi.fn().mockResolvedValue([]),
      });

      await expect(service.assertLessonAccessible(userId, lessonId)).resolves.toBeUndefined();
    });

    it("is unaffected for a public course with no org", async () => {
      const service = makeService({
        findLessonAccessContext: vi.fn().mockResolvedValue(lessonContext([], "PUBLIC")),
        findIdByUserAndCourse: vi.fn().mockResolvedValue({ id: "enroll_1" }),
        findCompletedLessonIds: vi.fn().mockResolvedValue([]),
      });

      await expect(service.assertLessonAccessible(userId, lessonId)).resolves.toBeUndefined();
    });
  });
});
