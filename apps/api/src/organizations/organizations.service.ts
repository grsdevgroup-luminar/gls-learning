import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type {
  AssignOrgCourseInput,
  CreateOrganizationInput,
  InviteOrgMemberInput,
  OrganizationDto,
  UpdateOrganizationInput,
} from "@skillstream/shared";
import type { RequestUser } from "../common/decorators";
import { PrismaService } from "../prisma/prisma.service";
import {
  COURSE_SUMMARY_INCLUDE,
  toCourseSummary,
} from "../courses/course.mapper";

const orgInclude = {
  members: { orderBy: { joinedAt: "asc" } },
  _count: { select: { courses: true } },
} satisfies Prisma.OrganizationInclude;
type OrgRow = Prisma.OrganizationGetPayload<{ include: typeof orgInclude }>;

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(o: OrgRow): OrganizationDto {
    return {
      id: o.id,
      slug: o.slug,
      name: o.name,
      domain: o.domain,
      logoUrl: o.logoUrl,
      adminEmail: o.adminEmail,
      status: o.status,
      seatCount: o.seatCount,
      usedSeats: o.usedSeats,
      createdAt: o.createdAt.toISOString(),
      members: o.members.map((m) => ({
        id: m.id,
        orgId: m.orgId,
        userId: m.userId,
        name: m.name,
        email: m.email,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
      privateCourseCount: o._count.courses,
    };
  }

  /** Platform ADMIN can manage any org; an org's own ADMIN member can manage it. */
  private async assertOrgAdmin(user: RequestUser, orgId: string) {
    if (user.role === "ADMIN") return;
    const member = await this.prisma.orgMember.findFirst({
      where: { orgId, userId: user.id, role: "ADMIN" },
    });
    if (!member) throw new ForbiddenException("Not an admin of this organization");
  }

  /** Accepts either the org id or its slug (the web app routes by slug). */
  private getRow(idOrSlug: string) {
    return this.prisma.organization
      .findFirstOrThrow({
        where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
        include: orgInclude,
      })
      .catch(() => {
        throw new NotFoundException("Organization not found");
      });
  }

  // ── platform admin ───────────────────────────────────────────────────────
  async create(input: CreateOrganizationInput): Promise<OrganizationDto> {
    const exists = await this.prisma.organization.findUnique({
      where: { slug: input.slug },
    });
    if (exists) throw new BadRequestException("Slug already in use");
    const org = await this.prisma.organization.create({
      data: {
        name: input.name,
        slug: input.slug,
        domain: input.domain,
        adminEmail: input.adminEmail,
        seatCount: input.seatCount,
        status: "TRIAL",
      },
      include: orgInclude,
    });
    return this.toDto(org);
  }

  async list(): Promise<OrganizationDto[]> {
    const rows = await this.prisma.organization.findMany({
      include: orgInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((o) => this.toDto(o));
  }

  async get(user: RequestUser, orgId: string): Promise<OrganizationDto> {
    const row = await this.getRow(orgId);
    await this.assertOrgAdmin(user, row.id);
    return this.toDto(row);
  }

  async update(
    user: RequestUser,
    orgId: string,
    input: UpdateOrganizationInput,
  ): Promise<OrganizationDto> {
    await this.assertOrgAdmin(user, orgId);
    await this.prisma.organization.update({ where: { id: orgId }, data: input });
    return this.toDto(await this.getRow(orgId));
  }

  // ── members / invitations ─────────────────────────────────────────────────
  async invite(user: RequestUser, orgId: string, input: InviteOrgMemberInput) {
    await this.assertOrgAdmin(user, orgId);
    const org = await this.getRow(orgId);
    if (org.usedSeats >= org.seatCount)
      throw new BadRequestException("No seats remaining");
    const token = randomUUID();
    return this.prisma.orgInvitation.create({
      data: {
        orgId,
        email: input.email.toLowerCase(),
        role: input.role,
        token,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
    });
  }

  /** A logged-in user claims an invitation, becoming an org member + consuming a seat. */
  async claimInvitation(user: RequestUser, token: string): Promise<OrganizationDto> {
    const invite = await this.prisma.orgInvitation.findUnique({ where: { token } });
    if (!invite || invite.claimedAt || invite.expiresAt < new Date())
      throw new BadRequestException("Invalid or expired invitation");

    const dbUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });

    await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.findUniqueOrThrow({
        where: { id: invite.orgId },
      });
      if (org.usedSeats >= org.seatCount)
        throw new BadRequestException("Organization is full");

      await tx.orgMember.upsert({
        where: { orgId_email: { orgId: invite.orgId, email: dbUser.email } },
        update: { userId: user.id, role: invite.role },
        create: {
          orgId: invite.orgId,
          userId: user.id,
          name: dbUser.name,
          email: dbUser.email,
          role: invite.role,
        },
      });
      await tx.organization.update({
        where: { id: invite.orgId },
        data: { usedSeats: { increment: 1 } },
      });
      await tx.orgInvitation.update({
        where: { token },
        data: { claimedAt: new Date() },
      });
      if (invite.role === "ADMIN")
        await tx.user.update({
          where: { id: user.id },
          data: { role: "ORG_ADMIN" },
        });
    });

    return this.toDto(await this.getRow(invite.orgId));
  }

  async removeMember(user: RequestUser, orgId: string, memberId: string) {
    await this.assertOrgAdmin(user, orgId);
    await this.prisma.orgMember.delete({ where: { id: memberId } });
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { usedSeats: { decrement: 1 } },
    });
    return this.toDto(await this.getRow(orgId));
  }

  // ── private course assignment ─────────────────────────────────────────────
  async assignCourse(
    user: RequestUser,
    orgId: string,
    input: AssignOrgCourseInput,
  ): Promise<OrganizationDto> {
    await this.assertOrgAdmin(user, orgId);
    await this.prisma.course.update({
      where: { id: input.courseId },
      data: { orgId, visibility: "PRIVATE" },
    });
    return this.toDto(await this.getRow(orgId));
  }

  /** Detach a private course from the org and return it to the public catalog. */
  async unassignCourse(
    user: RequestUser,
    orgId: string,
    courseId: string,
  ): Promise<OrganizationDto> {
    await this.assertOrgAdmin(user, orgId);
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, orgId },
    });
    if (!course) throw new NotFoundException("Course is not assigned to this organization");
    await this.prisma.course.update({
      where: { id: courseId },
      data: { orgId: null, visibility: "PUBLIC" },
    });
    return this.toDto(await this.getRow(orgId));
  }

  // ── invitation management ─────────────────────────────────────────────────
  async listInvitations(user: RequestUser, orgId: string) {
    await this.assertOrgAdmin(user, orgId);
    return this.prisma.orgInvitation.findMany({
      where: { orgId, claimedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
  }

  async revokeInvitation(user: RequestUser, orgId: string, inviteId: string) {
    await this.assertOrgAdmin(user, orgId);
    const invite = await this.prisma.orgInvitation.findUnique({
      where: { id: inviteId },
    });
    if (!invite || invite.orgId !== orgId)
      throw new NotFoundException("Invitation not found");
    await this.prisma.orgInvitation.delete({ where: { id: inviteId } });
    return { ok: true as const };
  }

  /** Courses assigned to an org — visible to any member (or platform admin). */
  async listCourses(user: RequestUser, orgId: string) {
    if (user.role !== "ADMIN") {
      const member = await this.prisma.orgMember.findFirst({
        where: { orgId, userId: user.id },
      });
      if (!member) throw new ForbiddenException("Not a member of this organization");
    }
    const rows = await this.prisma.course.findMany({
      where: { orgId },
      include: COURSE_SUMMARY_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(toCourseSummary);
  }

  /** Orgs the current user belongs to (for the member/org-admin portal). */
  async myOrganizations(user: RequestUser): Promise<OrganizationDto[]> {
    const memberships = await this.prisma.orgMember.findMany({
      where: { userId: user.id },
      select: { orgId: true },
    });
    if (!memberships.length) return [];
    const rows = await this.prisma.organization.findMany({
      where: { id: { in: memberships.map((m) => m.orgId) } },
      include: orgInclude,
    });
    return rows.map((o) => this.toDto(o));
  }
}
