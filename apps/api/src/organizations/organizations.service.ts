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
import { EmailService } from "../email/email.service";
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

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

  /** Resolves an id-or-slug route param to the real org id. `getRow` accepts
   *  either, so every other lookup must too — querying `orgMember.orgId` with a
   *  slug silently finds nothing and 403s instead of 404-ing. */
  private async resolveOrgId(idOrSlug: string): Promise<string> {
    return (await this.getRow(idOrSlug)).id;
  }

  /** Platform ADMIN can manage any org; an org's own ADMIN member can manage it. */
  private async assertOrgAdmin(user: RequestUser, idOrSlug: string): Promise<string> {
    const orgId = await this.resolveOrgId(idOrSlug);
    if (user.role === "ADMIN") return orgId;
    const member = await this.prisma.orgMember.findFirst({
      where: { orgId, userId: user.id, role: "ADMIN" },
    });
    if (!member) throw new ForbiddenException("Not an admin of this organization");
    return orgId;
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

  /**
   * Org admins may edit their own branding (name, domain, logo). `seatCount`
   * and `status` are commercial fields — letting a customer raise their own
   * seat count or lift a suspension would be self-serve entitlement — so those
   * are platform-admin only.
   */
  async update(
    user: RequestUser,
    idOrSlug: string,
    input: UpdateOrganizationInput,
  ): Promise<OrganizationDto> {
    const orgId = await this.assertOrgAdmin(user, idOrSlug);
    if (user.role !== "ADMIN" && (input.seatCount !== undefined || input.status !== undefined))
      throw new ForbiddenException(
        "Seat count and status are managed by SkillStream — contact support",
      );
    await this.prisma.organization.update({ where: { id: orgId }, data: input });
    return this.toDto(await this.getRow(orgId));
  }

  // ── members / invitations ─────────────────────────────────────────────────
  async invite(user: RequestUser, idOrSlug: string, input: InviteOrgMemberInput) {
    const orgId = await this.assertOrgAdmin(user, idOrSlug);
    const org = await this.getRow(orgId);
    if (org.usedSeats >= org.seatCount)
      throw new BadRequestException("No seats remaining");
    const token = randomUUID();
    const invitation = await this.prisma.orgInvitation.create({
      data: {
        orgId,
        email: input.email.toLowerCase(),
        role: input.role,
        token,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
    });
    // Deliver the join link. Non-blocking: the admin still gets the invitation
    // (with token) back so the link can be copied if email delivery fails.
    this.email
      .sendOrgInvite(invitation.email, org.name, invitation.role, token)
      .catch(() => {});
    return invitation;
  }

  /** Public: minimal invitation info for the join page (prefill + validity).
   *  The token is an unguessable secret, so returning the invited email is safe. */
  async invitationInfo(token: string) {
    const invite = await this.prisma.orgInvitation.findUnique({
      where: { token },
      include: { org: { select: { name: true, slug: true } } },
    });
    const valid =
      !!invite && !invite.claimedAt && invite.expiresAt > new Date();
    return {
      valid,
      email: invite?.email ?? null,
      role: invite?.role ?? null,
      orgName: invite?.org.name ?? null,
      orgSlug: invite?.org.slug ?? null,
    };
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

  async removeMember(user: RequestUser, idOrSlug: string, memberId: string) {
    const orgId = await this.assertOrgAdmin(user, idOrSlug);
    const member = await this.prisma.orgMember.findFirst({
      where: { id: memberId, orgId },
    });
    if (!member) throw new NotFoundException("Member not found");
    if (member.role === "ADMIN") {
      const admins = await this.prisma.orgMember.count({
        where: { orgId, role: "ADMIN" },
      });
      if (admins <= 1)
        throw new BadRequestException("An organization must keep one admin");
    }
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
    idOrSlug: string,
    input: AssignOrgCourseInput,
  ): Promise<OrganizationDto> {
    const orgId = await this.assertOrgAdmin(user, idOrSlug);
    await this.prisma.course.update({
      where: { id: input.courseId },
      data: { orgId, visibility: "PRIVATE" },
    });
    return this.toDto(await this.getRow(orgId));
  }

  /** Detach a private course from the org and return it to the public catalog. */
  async unassignCourse(
    user: RequestUser,
    idOrSlug: string,
    courseId: string,
  ): Promise<OrganizationDto> {
    const orgId = await this.assertOrgAdmin(user, idOrSlug);
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
  async listInvitations(user: RequestUser, idOrSlug: string) {
    const orgId = await this.assertOrgAdmin(user, idOrSlug);
    return this.prisma.orgInvitation.findMany({
      where: { orgId, claimedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
  }

  async revokeInvitation(user: RequestUser, idOrSlug: string, inviteId: string) {
    const orgId = await this.assertOrgAdmin(user, idOrSlug);
    const invite = await this.prisma.orgInvitation.findUnique({
      where: { id: inviteId },
    });
    if (!invite || invite.orgId !== orgId)
      throw new NotFoundException("Invitation not found");
    await this.prisma.orgInvitation.delete({ where: { id: inviteId } });
    return { ok: true as const };
  }

  /** Courses assigned to an org — visible to any member (or platform admin). */
  /** Any member (not just admins) can see the org's assigned courses. */
  async listCourses(user: RequestUser, idOrSlug: string) {
    const orgId = await this.resolveOrgId(idOrSlug);
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
