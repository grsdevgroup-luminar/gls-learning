import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { RequestUser } from "../../../common/decorators/decorators";
import type { CategoriesService } from "../../categories/categories.service";
import type { MediaService } from "../../media/media.service";
import type { NotificationsService } from "../../notifications/notifications.service";
import type { StorageDriver } from "../../storage/storage.driver";
import { AuthoringService } from "../authoring.service";
import type { AuthoringRepository } from "../authoring.repository";

const admin: RequestUser = { id: "admin_1", email: "a@x.com", role: "ADMIN", mustChangePassword: false };
const instructor: RequestUser = {
  id: "instr_1",
  email: "i@x.com",
  role: "INSTRUCTOR",
  mustChangePassword: false,
};

function makeCourseInstructorRow(overrides: Record<string, unknown> = {}) {
  return {
    instructorId: "instr_1",
    category: "Dev",
    status: "PUBLISHED",
    visibility: "PUBLIC",
    ...overrides,
  };
}

function makeService(repoOverrides: Partial<AuthoringRepository> = {}) {
  const repo = {
    findCourseInstructor: vi.fn().mockResolvedValue(makeCourseInstructorRow()),
    countOrgAssignments: vi.fn().mockResolvedValue(0),
    updateCourse: vi.fn().mockResolvedValue(undefined),
    findCourseDetailOrThrow: vi.fn().mockResolvedValue({
      id: "course_1",
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
      description: "",
      whatYouLearn: [],
      requirements: [],
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      instructor: { id: "instr_1", name: "Ada", avatar: null, instructorProfile: null },
      sections: [],
    }),
    findCoursePriorStatus: vi
      .fn()
      .mockResolvedValue({ publishedAt: new Date(), instructorId: "instr_1" }),
    setCourseStatusWithInstructorBump: vi.fn().mockResolvedValue(undefined),
    ...repoOverrides,
  } as unknown as AuthoringRepository;

  const storage = {} as StorageDriver;
  const categories = {
    ensureForAuthor: vi.fn(),
    assertActive: vi.fn().mockResolvedValue(undefined),
  } as unknown as CategoriesService;
  const media = {} as MediaService;
  const notifications = {
    notify: vi.fn().mockResolvedValue(undefined),
    notifyAdmins: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService;

  const service = new AuthoringService(repo, storage, categories, media, notifications);
  return { service, repo, categories, notifications };
}

describe("AuthoringService.update — visibility gating", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a non-admin instructor trying to set visibility", async () => {
    const { service } = makeService();

    await expect(
      service.update(instructor, "course_1", { visibility: "PRIVATE" }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("lets the platform ADMIN set visibility", async () => {
    const { service, repo } = makeService();

    await service.update(admin, "course_1", { visibility: "PRIVATE" });
    expect(repo.updateCourse).toHaveBeenCalledWith(
      "course_1",
      expect.objectContaining({ visibility: "PRIVATE" }),
    );
  });

  it("rejects making a DRAFT course private", async () => {
    const { service, repo } = makeService({
      findCourseInstructor: vi.fn().mockResolvedValue(makeCourseInstructorRow({ status: "DRAFT" })),
    });

    await expect(
      service.update(admin, "course_1", { visibility: "PRIVATE" }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.updateCourse).not.toHaveBeenCalled();
  });

  it("allows making a PUBLISHED course private", async () => {
    const { service, repo } = makeService({
      findCourseInstructor: vi
        .fn()
        .mockResolvedValue(makeCourseInstructorRow({ status: "PUBLISHED" })),
    });

    await service.update(admin, "course_1", { visibility: "PRIVATE" });
    expect(repo.updateCourse).toHaveBeenCalledWith(
      "course_1",
      expect.objectContaining({ visibility: "PRIVATE" }),
    );
  });

  it("blocks flipping a course back to public while it still has org assignments", async () => {
    const { service, repo } = makeService({
      findCourseInstructor: vi
        .fn()
        .mockResolvedValue(makeCourseInstructorRow({ visibility: "PRIVATE" })),
      countOrgAssignments: vi.fn().mockResolvedValue(2),
    });

    await expect(
      service.update(admin, "course_1", { visibility: "PUBLIC" }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.updateCourse).not.toHaveBeenCalled();
  });

  it("allows flipping a course back to public once it has no org assignments", async () => {
    const { service, repo } = makeService({
      findCourseInstructor: vi
        .fn()
        .mockResolvedValue(makeCourseInstructorRow({ visibility: "PRIVATE" })),
      countOrgAssignments: vi.fn().mockResolvedValue(0),
    });

    await service.update(admin, "course_1", { visibility: "PUBLIC" });
    expect(repo.updateCourse).toHaveBeenCalledWith(
      "course_1",
      expect.objectContaining({ visibility: "PUBLIC" }),
    );
  });
});

describe("AuthoringService.setStatus — blocked while org-assigned", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks unpublishing a PUBLIC course that's still assigned to an org", async () => {
    const { service, repo } = makeService({
      findCourseInstructor: vi.fn().mockResolvedValue(makeCourseInstructorRow({ visibility: "PUBLIC" })),
      countOrgAssignments: vi.fn().mockResolvedValue(1),
    });

    await expect(service.setStatus(admin, "course_1", { status: "DRAFT" })).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.setCourseStatusWithInstructorBump).not.toHaveBeenCalled();
  });

  it("blocks unpublishing a PRIVATE course that's still assigned to an org", async () => {
    const { service, repo } = makeService({
      findCourseInstructor: vi
        .fn()
        .mockResolvedValue(makeCourseInstructorRow({ visibility: "PRIVATE" })),
      countOrgAssignments: vi.fn().mockResolvedValue(1),
    });

    await expect(service.setStatus(admin, "course_1", { status: "DRAFT" })).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.setCourseStatusWithInstructorBump).not.toHaveBeenCalled();
  });

  it("allows unpublishing once the course has no org assignments left", async () => {
    const { service, repo } = makeService({
      countOrgAssignments: vi.fn().mockResolvedValue(0),
    });

    await service.setStatus(admin, "course_1", { status: "DRAFT" });
    expect(repo.setCourseStatusWithInstructorBump).toHaveBeenCalled();
  });

  it("never blocks re-publishing regardless of org assignment count", async () => {
    const { service, repo } = makeService({
      countOrgAssignments: vi.fn().mockResolvedValue(3),
    });

    await service.setStatus(admin, "course_1", { status: "PUBLISHED" });
    expect(repo.setCourseStatusWithInstructorBump).toHaveBeenCalled();
  });
});
