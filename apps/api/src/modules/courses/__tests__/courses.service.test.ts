import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { CoursesService } from "../courses.service";
import type { CoursesRepository } from "../courses.repository";
import type { EnrollmentService } from "../../enrollment/enrollment.service";
import type { CategoriesService } from "../../categories/categories.service";
import type { StorageDriver } from "../../storage/storage.driver";
import type { RequestUser } from "../../../common/decorators/decorators";

const admin: RequestUser = { id: "admin_1", email: "a@x.com", role: "ADMIN", mustChangePassword: false };
const member: RequestUser = { id: "member_1", email: "m@x.com", role: "STUDENT", mustChangePassword: false };
const stranger: RequestUser = { id: "stranger_1", email: "s@x.com", role: "STUDENT", mustChangePassword: false };

function makeCourseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "course_1",
    slug: "intro-to-x",
    title: "Intro to X",
    subtitle: null,
    category: "Dev",
    level: "BEGINNER",
    thumbnail: null,
    status: "PUBLISHED",
    visibility: "PUBLIC",
    orgAssignments: [] as { orgId: string }[],
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
    ...overrides,
  };
}

function makeService(repoOverrides: Partial<CoursesRepository> = {}) {
  const repo = {
    findBySlug: vi.fn().mockResolvedValue(null),
    ...repoOverrides,
  } as unknown as CoursesRepository;
  const enrollment = {
    isOrgMemberOfAny: vi.fn().mockResolvedValue(false),
  } as unknown as EnrollmentService;
  const categoriesRepo = {} as CategoriesService;
  const storage = {} as StorageDriver;

  const service = new CoursesService(repo, enrollment, categoriesRepo, storage);
  return { service, repo, enrollment };
}

describe("CoursesService.bySlug — visibility & status gating", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a PUBLIC/PUBLISHED course to an anonymous caller", async () => {
    const { service } = makeService({ findBySlug: vi.fn().mockResolvedValue(makeCourseRow()) });
    await expect(service.bySlug("intro-to-x")).resolves.toMatchObject({ id: "course_1" });
  });

  it("404s a DRAFT course for an anonymous caller", async () => {
    const { service } = makeService({
      findBySlug: vi.fn().mockResolvedValue(makeCourseRow({ status: "DRAFT" })),
    });
    await expect(service.bySlug("intro-to-x")).rejects.toThrow(NotFoundException);
  });

  it("lets a platform ADMIN preview a DRAFT course", async () => {
    const { service } = makeService({
      findBySlug: vi.fn().mockResolvedValue(makeCourseRow({ status: "DRAFT" })),
    });
    await expect(service.bySlug("intro-to-x", admin)).resolves.toMatchObject({ id: "course_1" });
  });

  it("404s a PRIVATE org course for an anonymous caller", async () => {
    const { service } = makeService({
      findBySlug: vi
        .fn()
        .mockResolvedValue(makeCourseRow({ visibility: "PRIVATE", orgAssignments: [{ orgId: "org_1" }] })),
    });
    await expect(service.bySlug("intro-to-x")).rejects.toThrow(NotFoundException);
  });

  it("404s a PRIVATE org course for an authenticated non-member", async () => {
    const { service, enrollment } = makeService({
      findBySlug: vi
        .fn()
        .mockResolvedValue(makeCourseRow({ visibility: "PRIVATE", orgAssignments: [{ orgId: "org_1" }] })),
    });
    vi.mocked(enrollment.isOrgMemberOfAny).mockResolvedValue(false);
    await expect(service.bySlug("intro-to-x", stranger)).rejects.toThrow(NotFoundException);
  });

  it("returns a PRIVATE course assigned to multiple orgs to a member of any one of them", async () => {
    const { service, enrollment } = makeService({
      findBySlug: vi.fn().mockResolvedValue(
        makeCourseRow({
          visibility: "PRIVATE",
          orgAssignments: [{ orgId: "org_1" }, { orgId: "org_2" }],
        }),
      ),
    });
    vi.mocked(enrollment.isOrgMemberOfAny).mockResolvedValue(true);
    await expect(service.bySlug("intro-to-x", member)).resolves.toMatchObject({ id: "course_1" });
    expect(enrollment.isOrgMemberOfAny).toHaveBeenCalledWith(["org_1", "org_2"], member.id);
  });
});

describe("CoursesService.list — compact search", () => {
  it("keeps normalized matches for multi-word compact queries", async () => {
    const listAndCount = vi.fn().mockResolvedValue([[], 0]);
    const findIdsByCompactSearch = vi.fn().mockResolvedValue([{ id: "course_1" }]);
    const { service, repo } = makeService({ listAndCount, findIdsByCompactSearch });

    await service.list({ q: "learncloudcomputing", sort: "popular", page: 1, pageSize: 12 });

    const where = vi.mocked(repo.listAndCount).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(where.OR).toEqual([
      { title: { contains: "learncloudcomputing", mode: "insensitive" } },
      { category: { contains: "learncloudcomputing", mode: "insensitive" } },
      { id: { in: ["course_1"] } },
    ]);
    expect(findIdsByCompactSearch).toHaveBeenCalledOnce();
  });
});
