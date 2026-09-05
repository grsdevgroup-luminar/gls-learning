import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { RequestUser } from "../../../common/decorators/decorators";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { EmailService } from "../../email/email.service";
import type { NotificationsService } from "../../notifications/notifications.service";
import { OrganizationsService } from "../organizations.service";
import type { OrganizationsRepository, OrgRow } from "../organizations.repository";

const platformAdmin: RequestUser = {
  id: "admin_1",
  email: "admin@skillstream.dev",
  role: "ADMIN",
  mustChangePassword: false,
};
const orgAdminUser: RequestUser = {
  id: "org_admin_1",
  email: "orgadmin@techcorp.io",
  role: "ORG_ADMIN",
  mustChangePassword: false,
};

function makeOrgRow(overrides: Partial<OrgRow> = {}): OrgRow {
  return {
    id: "org_1",
    slug: "techcorp",
    name: "TechCorp",
    domain: null,
    logoUrl: null,
    adminEmail: "admin@techcorp.io",
    status: "TRIAL",
    suspensionMode: null,
    accessLocksAt: null,
    seatCount: 10,
    usedSeats: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    members: [],
    _count: { courses: 0 },
    ...overrides,
  } as unknown as OrgRow;
}

function makeService(repoOverrides: Partial<OrganizationsRepository> = {}) {
  const repo = {
    findOrgBySlug: vi.fn().mockResolvedValue(null),
    findUserByEmail: vi.fn().mockResolvedValue(null),
    findOrgBySlugOrId: vi.fn(),
    findAdminMembership: vi.fn(),
    findOrgMembership: vi.fn(),
    findOrgCourses: vi.fn().mockResolvedValue([]),
    ...repoOverrides,
  } as unknown as OrganizationsRepository;

  const prisma = {
    $transaction: vi.fn(async (fn: (tx: object) => Promise<unknown>) => fn({})),
  } as unknown as PrismaService;

  const email = {
    sendOrgAdminCredentials: vi.fn().mockResolvedValue(undefined),
  } as unknown as EmailService;

  const notifications = {} as NotificationsService;

  const service = new OrganizationsService(prisma, repo, email, notifications);
  return { service, repo, email };
}

describe("OrganizationsService.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("auto-generates a unique slug, appending -2/-3 on collision", async () => {
    const createOrganizationWithAdmin = vi.fn().mockResolvedValue(makeOrgRow({ slug: "techcorp-3" }));
    const findOrgBySlug = vi.fn(async (slug: string) =>
      slug === "techcorp" || slug === "techcorp-2" ? { id: "x" } : null,
    ) as unknown as OrganizationsRepository["findOrgBySlug"];
    const { service } = makeService({ findOrgBySlug, createOrganizationWithAdmin });

    await service.create({
      name: "TechCorp",
      adminEmail: "admin@techcorp.io",
      seatCount: 10,
    });

    expect(createOrganizationWithAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "techcorp-3" }),
      expect.anything(),
      expect.anything(),
    );
  });

  it("rejects when the admin email already has an account", async () => {
    const { service } = makeService({
      findUserByEmail: vi.fn().mockResolvedValue({ id: "existing_user" }),
    });

    await expect(
      service.create({ name: "TechCorp", adminEmail: "taken@techcorp.io", seatCount: 10 }),
    ).rejects.toThrow(BadRequestException);
  });

  it("returns the raw temp password and reports email delivery success", async () => {
    const createOrganizationWithAdmin = vi.fn().mockResolvedValue(makeOrgRow());
    const { service, email } = makeService({ createOrganizationWithAdmin });

    const result = await service.create({
      name: "TechCorp",
      adminEmail: "admin@techcorp.io",
      seatCount: 10,
    });

    expect(result.tempPassword).toBeTruthy();
    expect(result.credentialsEmailSent).toBe(true);
    expect(email.sendOrgAdminCredentials).toHaveBeenCalled();
  });

  it("still returns the org and temp password if the credentials email fails to send", async () => {
    const createOrganizationWithAdmin = vi.fn().mockResolvedValue(makeOrgRow());
    const { service, email } = makeService({ createOrganizationWithAdmin });
    vi.mocked(email.sendOrgAdminCredentials).mockRejectedValue(new Error("smtp down"));

    const result = await service.create({
      name: "TechCorp",
      adminEmail: "admin@techcorp.io",
      seatCount: 10,
    });

    expect(result.credentialsEmailSent).toBe(false);
    expect(result.tempPassword).toBeTruthy();
  });
});

describe("OrganizationsService.update — suspension", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults to LOCK_NOW with accessLocksAt in the past", async () => {
    const updateOrganization = vi.fn().mockResolvedValue(undefined);
    const { service, repo } = makeService({
      updateOrganization,
      findOrgBySlugOrId: vi.fn().mockResolvedValue(makeOrgRow({ status: "SUSPENDED" })),
    });
    vi.mocked(repo.findOrgBySlugOrId).mockResolvedValue(makeOrgRow({ status: "SUSPENDED" }));

    await service.update(platformAdmin, "org_1", { status: "SUSPENDED" });

    const [, data] = updateOrganization.mock.calls[0];
    expect(data.suspensionMode).toBe("LOCK_NOW");
    expect(data.accessLocksAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("computes a future accessLocksAt for a grace-period suspension", async () => {
    const updateOrganization = vi.fn().mockResolvedValue(undefined);
    const { service, repo } = makeService({ updateOrganization });
    vi.mocked(repo.findOrgBySlugOrId).mockResolvedValue(makeOrgRow());

    await service.update(platformAdmin, "org_1", {
      status: "SUSPENDED",
      suspensionMode: "GRACE_PERIOD",
      graceDays: 14,
    });

    const [, data] = updateOrganization.mock.calls[0];
    expect(data.suspensionMode).toBe("GRACE_PERIOD");
    const expected = Date.now() + 14 * 86_400_000;
    expect(data.accessLocksAt.getTime()).toBeGreaterThan(Date.now());
    expect(Math.abs(data.accessLocksAt.getTime() - expected)).toBeLessThan(5000);
  });

  it("requires graceDays for a grace-period suspension", async () => {
    const { service, repo } = makeService();
    vi.mocked(repo.findOrgBySlugOrId).mockResolvedValue(makeOrgRow());

    await expect(
      service.update(platformAdmin, "org_1", {
        status: "SUSPENDED",
        suspensionMode: "GRACE_PERIOD",
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("clears suspension fields on reactivation", async () => {
    const updateOrganization = vi.fn().mockResolvedValue(undefined);
    const { service, repo } = makeService({ updateOrganization });
    vi.mocked(repo.findOrgBySlugOrId).mockResolvedValue(
      makeOrgRow({ status: "SUSPENDED", suspensionMode: "LOCK_NOW", accessLocksAt: new Date() }),
    );

    await service.update(platformAdmin, "org_1", { status: "ACTIVE" });

    const [, data] = updateOrganization.mock.calls[0];
    expect(data.suspensionMode).toBeNull();
    expect(data.accessLocksAt).toBeNull();
  });

  it("rejects a non-platform-admin trying to change status or suspensionMode", async () => {
    const { service, repo } = makeService({
      findAdminMembership: vi.fn().mockResolvedValue({ id: "member_1" }),
    });
    vi.mocked(repo.findOrgBySlugOrId).mockResolvedValue(makeOrgRow());

    await expect(
      service.update(orgAdminUser, "org_1", { suspensionMode: "LOCK_NOW" }),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe("OrganizationsService — lock enforcement", () => {
  beforeEach(() => vi.clearAllMocks());

  const lockedOrg = makeOrgRow({
    status: "SUSPENDED",
    suspensionMode: "LOCK_NOW",
    accessLocksAt: new Date(Date.now() - 1000),
  });

  it("blocks the org's own admin from the portal once access is locked", async () => {
    const { service, repo } = makeService({
      findAdminMembership: vi.fn().mockResolvedValue({ id: "member_1" }),
    });
    vi.mocked(repo.findOrgBySlugOrId).mockResolvedValue(lockedOrg);

    await expect(service.get(orgAdminUser, "org_1")).rejects.toThrow(ForbiddenException);
  });

  it("platform ADMIN still has full access to a locked org", async () => {
    const { service, repo } = makeService();
    vi.mocked(repo.findOrgBySlugOrId).mockResolvedValue(lockedOrg);

    await expect(service.get(platformAdmin, "org_1")).resolves.toMatchObject({ id: "org_1" });
  });

  it("blocks a member from listing courses once access is locked", async () => {
    const { service, repo } = makeService({
      findOrgMembership: vi.fn().mockResolvedValue({ id: "member_1" }),
    });
    vi.mocked(repo.findOrgBySlugOrId).mockResolvedValue(lockedOrg);

    await expect(
      service.listCourses({ ...orgAdminUser, role: "STUDENT" }, "org_1"),
    ).rejects.toThrow(ForbiddenException);
  });
});
