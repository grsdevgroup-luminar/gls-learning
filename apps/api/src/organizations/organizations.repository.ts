import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { COURSE_SUMMARY_INCLUDE } from "../courses/course.mapper";

export const ORG_INCLUDE = {
  members: { orderBy: { joinedAt: "asc" } },
  _count: { select: { courses: true } },
} satisfies Prisma.OrganizationInclude;

export type OrgRow = Prisma.OrganizationGetPayload<{
  include: typeof ORG_INCLUDE;
}>;

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db) {
    return tx ?? this.prisma;
  }

  findOrgBySlugOrId(idOrSlug: string) {
    return this.prisma.organization
      .findFirstOrThrow({
        where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
        include: ORG_INCLUDE,
      });
  }

  findAdminMembership(orgId: string, userId: string) {
    return this.prisma.orgMember.findFirst({
      where: { orgId, userId, role: "ADMIN" },
    });
  }

  findOrgBySlug(slug: string) {
    return this.prisma.organization.findUnique({
      where: { slug },
    });
  }

  createOrganization(data: Prisma.OrganizationCreateInput) {
    return this.prisma.organization.create({
      data,
      include: ORG_INCLUDE,
    });
  }

  findManyOrganizations() {
    return this.prisma.organization.findMany({
      include: ORG_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  updateOrganization(
    orgId: string,
    data: Prisma.OrganizationUpdateInput,
    tx?: Db,
  ) {
    return this.db(tx).organization.update({ where: { id: orgId }, data });
  }

  createInvitation(data: Prisma.OrgInvitationUncheckedCreateInput) {
    return this.prisma.orgInvitation.create({ data });
  }

  findInvitationByToken(token: string) {
    return this.prisma.orgInvitation.findUnique({
      where: { token },
      include: { org: { select: { name: true, slug: true } } },
    });
  }

  findInvitationByTokenPlain(token: string, tx?: Db) {
    return this.db(tx).orgInvitation.findUnique({ where: { token } });
  }

  findUserByIdOrThrow(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
  }

  findOrgByIdOrThrow(orgId: string, tx?: Db) {
    return this.db(tx).organization.findUniqueOrThrow({
      where: { id: orgId },
    });
  }

  upsertOrgMember(
    orgId: string,
    userId: string,
    email: string,
    name: string,
    role: Prisma.OrgMemberCreateInput["role"],
    tx?: Db,
  ) {
    return this.db(tx).orgMember.upsert({
      where: { orgId_email: { orgId, email } },
      update: { userId, role },
      create: {
        orgId,
        userId,
        name,
        email,
        role,
      },
    });
  }

  incrementUsedSeats(orgId: string, tx?: Db) {
    return this.db(tx).organization.update({
      where: { id: orgId },
      data: { usedSeats: { increment: 1 } },
    });
  }

  markInvitationClaimed(token: string, tx?: Db) {
    return this.db(tx).orgInvitation.update({
      where: { token },
      data: { claimedAt: new Date() },
    });
  }

  updateUserRole(
    userId: string,
    role: Prisma.UserUpdateInput["role"],
    tx?: Db,
  ) {
    return this.db(tx).user.update({
      where: { id: userId },
      data: { role },
    });
  }

  findMember(memberId: string, orgId: string) {
    return this.prisma.orgMember.findFirst({
      where: { id: memberId, orgId },
    });
  }

  countAdmins(orgId: string) {
    return this.prisma.orgMember.count({
      where: { orgId, role: "ADMIN" },
    });
  }

  deleteMember(memberId: string) {
    return this.prisma.orgMember.delete({ where: { id: memberId } });
  }

  decrementUsedSeats(orgId: string) {
    return this.prisma.organization.update({
      where: { id: orgId },
      data: { usedSeats: { decrement: 1 } },
    });
  }

  assignCourseToOrg(courseId: string, orgId: string) {
    return this.prisma.course.update({
      where: { id: courseId },
      data: { orgId, visibility: "PRIVATE" },
    });
  }

  findCourseInOrg(courseId: string, orgId: string) {
    return this.prisma.course.findFirst({
      where: { id: courseId, orgId },
    });
  }

  unassignCourseFromOrg(courseId: string) {
    return this.prisma.course.update({
      where: { id: courseId },
      data: { orgId: null, visibility: "PUBLIC" },
    });
  }

  findActiveInvitations(orgId: string) {
    return this.prisma.orgInvitation.findMany({
      where: { orgId, claimedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
  }

  findInvitationById(inviteId: string) {
    return this.prisma.orgInvitation.findUnique({
      where: { id: inviteId },
    });
  }

  deleteInvitation(inviteId: string) {
    return this.prisma.orgInvitation.delete({ where: { id: inviteId } });
  }

  findOrgMembership(orgId: string, userId: string) {
    return this.prisma.orgMember.findFirst({
      where: { orgId, userId },
    });
  }

  findOrgCourses(orgId: string) {
    return this.prisma.course.findMany({
      where: { orgId },
      include: COURSE_SUMMARY_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });
  }

  findUserMemberships(userId: string) {
    return this.prisma.orgMember.findMany({
      where: { userId },
      select: { orgId: true },
    });
  }

  findOrganizationsByIds(ids: string[]) {
    return this.prisma.organization.findMany({
      where: { id: { in: ids } },
      include: ORG_INCLUDE,
    });
  }
}
