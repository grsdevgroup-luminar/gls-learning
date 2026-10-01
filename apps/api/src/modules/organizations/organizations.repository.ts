import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { COURSE_SUMMARY_INCLUDE } from "../courses/course.mapper";
import type { Db } from "../../common/types";

export const ORG_INCLUDE = {
  // Active roster only — a soft-removed member (see OrgMember.removedAt) is
  // no longer part of the org's day-to-day view; their history is admin-only,
  // via findMembershipHistory below.
  members: { where: { removedAt: null }, orderBy: { joinedAt: "asc" } },
  _count: { select: { courseAssignments: true } },
} satisfies Prisma.OrganizationInclude;

export type OrgRow = Prisma.OrganizationGetPayload<{
  include: typeof ORG_INCLUDE;
}>;

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
      where: { orgId, userId, role: "ADMIN", removedAt: null },
    });
  }

  findOrgBySlug(slug: string) {
    return this.prisma.organization.findUnique({
      where: { slug },
    });
  }

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email }, select: { id: true } });
  }

  findUsersByIds(ids: string[]) {
    return this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
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

  createOrganizationWithAdmin(
    org: Omit<Prisma.OrganizationCreateInput, "usedSeats">,
    admin: { email: string; name: string; passwordHash: string },
    tx: Db,
  ) {
    return this.db(tx).organization.create({
      data: {
        ...org,
        usedSeats: 0,
        members: {
          create: {
            email: admin.email,
            name: admin.name,
            role: "ADMIN",
            user: {
              create: {
                email: admin.email,
                name: admin.name,
                passwordHash: admin.passwordHash,
                role: "ORG_ADMIN",
                mustChangePassword: true,
              },
            },
          },
        },
      },
      include: ORG_INCLUDE,
    });
  }

  createInvitation(data: Prisma.OrgInvitationUncheckedCreateInput, tx?: Db) {
    return this.db(tx).orgInvitation.create({ data });
  }

  /** Lifetime counter — incremented alongside createInvitation, in the same
   *  transaction, and never decremented anywhere. */
  incrementTotalInvitesSent(orgId: string, tx?: Db) {
    return this.db(tx).organization.update({
      where: { id: orgId },
      data: { totalInvitesSent: { increment: 1 } },
    });
  }

  /** An open (unclaimed, undeclined, unexpired) invitation for this email —
   *  used to reject a duplicate invite before creating another one. */
  findPendingInvitation(orgId: string, email: string, tx?: Db) {
    return this.db(tx).orgInvitation.findFirst({
      where: { orgId, email, claimedAt: null, declinedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  /** An active (non-removed) member with this email — used alongside
   *  findPendingInvitation so inviting someone already on the roster is
   *  rejected the same way as re-inviting a pending one. */
  findActiveMemberByEmail(orgId: string, email: string, tx?: Db) {
    return this.db(tx).orgMember.findFirst({
      where: { orgId, email, removedAt: null },
    });
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

  /** Not a Prisma `upsert` — the unique key on (orgId, email) is now a
   *  *partial* index (active rows only, see the migration), which Prisma's
   *  generated compound-unique input can't target. Idempotent for a
   *  still-active membership (re-claiming updates it in place); if the only
   *  match is a soft-removed historical row, a genuinely new membership row
   *  is created rather than reviving the old one — reviving a specific past
   *  removal is what the admin-only restore flow is for. */
  async upsertOrgMember(
    orgId: string,
    userId: string,
    email: string,
    name: string,
    role: Prisma.OrgMemberCreateInput["role"],
    tx?: Db,
  ) {
    const db = this.db(tx);
    const active = await db.orgMember.findFirst({
      where: { orgId, email, removedAt: null },
    });
    if (active) {
      return db.orgMember.update({ where: { id: active.id }, data: { userId, role } });
    }
    return db.orgMember.create({ data: { orgId, userId, name, email, role } });
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

  markInvitationDeclined(token: string, tx?: Db) {
    return this.db(tx).orgInvitation.update({
      where: { token },
      data: { declinedAt: new Date() },
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
      where: { id: memberId, orgId, removedAt: null },
    });
  }

  countAdmins(orgId: string) {
    return this.prisma.orgMember.count({
      where: { orgId, role: "ADMIN", removedAt: null },
    });
  }

  /** Soft delete — the row is kept (with removedAt/removedBy/removedReason
   *  set) so a platform admin can see and restore it later. See OrgMember's
   *  doc comment in schema.prisma. */
  softRemoveMember(memberId: string, removedBy: string, removedReason: string | null) {
    return this.prisma.orgMember.update({
      where: { id: memberId },
      data: { removedAt: new Date(), removedBy, removedReason },
    });
  }

  /** Every membership row (active + soft-removed) this student has ever had
   *  in any org — admin-only view, see AdminService.studentMemberships. */
  findMembershipHistory(userId: string) {
    return this.prisma.orgMember.findMany({
      where: { userId },
      include: { org: { select: { id: true, name: true } } },
      orderBy: { joinedAt: "desc" },
    });
  }

  findMostRecentRemovedMembership(userId: string, orgId: string) {
    return this.prisma.orgMember.findFirst({
      where: { userId, orgId, removedAt: { not: null } },
      orderBy: { removedAt: "desc" },
    });
  }

  /** Un-deletes the same row (preserves the original joinedAt) rather than
   *  creating a new one — see softRemoveMember's doc comment. */
  restoreMember(memberId: string, tx?: Db) {
    return this.db(tx).orgMember.update({
      where: { id: memberId },
      data: { removedAt: null, removedBy: null, removedReason: null },
    });
  }

  decrementUsedSeats(orgId: string) {
    return this.prisma.organization.update({
      where: { id: orgId },
      data: { usedSeats: { decrement: 1 } },
    });
  }

  /** Precondition check for assignment — a course must be Published before
   *  it can appear in any org's list (public or private assignment). */
  findCourseStatus(courseId: string) {
    return this.prisma.course.findUnique({
      where: { id: courseId },
      select: { status: true },
    });
  }

  /** Many-to-many — a course keeps whatever `visibility` it already has.
   *  Assignment is pure distribution: for a PUBLIC course it's curation (the
   *  course was already open to everyone); for a PRIVATE course this row is
   *  what actually grants that org's members access. */
  assignCourseToOrg(courseId: string, orgId: string) {
    return this.prisma.courseOrgAssignment.create({ data: { courseId, orgId } });
  }

  findCourseInOrg(courseId: string, orgId: string) {
    return this.prisma.courseOrgAssignment.findUnique({
      where: { courseId_orgId: { courseId, orgId } },
    });
  }

  /** Never touches `visibility` — a PRIVATE course stays PRIVATE (even with
   *  zero remaining assignments) until an admin deliberately flips it back to
   *  PUBLIC via course CRUD (AuthoringService.update, blocked while any
   *  assignment remains). */
  unassignCourseFromOrg(courseId: string, orgId: string) {
    return this.prisma.courseOrgAssignment.deleteMany({ where: { courseId, orgId } });
  }

  findActiveInvitations(orgId: string) {
    return this.prisma.orgInvitation.findMany({
      where: { orgId, claimedAt: null, declinedAt: null, expiresAt: { gt: new Date() } },
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
      where: { orgId, userId, removedAt: null },
    });
  }

  findOrgCourses(orgId: string) {
    return this.prisma.course.findMany({
      where: { orgAssignments: { some: { orgId } } },
      include: COURSE_SUMMARY_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });
  }

  findOrgLearningCourses(orgId: string) {
    return this.prisma.course.findMany({
      where: { orgAssignments: { some: { orgId } } },
      select: {
        id: true,
        title: true,
        sections: {
          where: { archivedAt: null },
          select: {
            lessons: { where: { archivedAt: null }, select: { id: true } },
          },
        },
      },
    });
  }

  findOrgLearnerUserIds(orgId: string) {
    return this.prisma.orgMember.findMany({
      where: { orgId, role: "MEMBER", removedAt: null, userId: { not: null } },
      select: { userId: true },
    });
  }

  findOrgMemberEnrollments(courseIds: string[], userIds: string[]) {
    if (courseIds.length === 0 || userIds.length === 0) return Promise.resolve([]);
    return this.prisma.enrollment.findMany({
      where: { courseId: { in: courseIds }, userId: { in: userIds } },
      select: {
        userId: true,
        courseId: true,
        watchTimeSec: true,
        enrolledAt: true,
        lastActivityAt: true,
        lessonProgress: {
          where: {
            completed: true,
            lesson: { archivedAt: null, section: { archivedAt: null } },
          },
          select: { lessonId: true },
        },
      },
      orderBy: { lastActivityAt: "desc" },
    });
  }

  findUserMemberships(userId: string) {
    return this.prisma.orgMember.findMany({
      where: { userId, removedAt: null },
      select: { orgId: true },
    });
  }

  findOrganizationsByIds(ids: string[]) {
    return this.prisma.organization.findMany({
      where: { id: { in: ids } },
      include: ORG_INCLUDE,
    });
  }

  /** Real recipients for org-admin notifications — an org can have more than
   *  one ADMIN member, and a still-pending admin invite has no `userId` yet. */
  findOrgAdminUserIds(orgId: string, tx?: Db) {
    return this.db(tx).orgMember.findMany({
      where: { orgId, role: "ADMIN", userId: { not: null }, removedAt: null },
      select: { userId: true },
    });
  }

  /** Invitations that expired since the last sweep and were never claimed —
   *  the window (not a stored "already notified" flag) is what keeps a
   *  nightly job from re-notifying the same expiry forever. */
  findRecentlyExpiredUnclaimedInvitations(since: Date, now: Date) {
    return this.prisma.orgInvitation.findMany({
      where: { claimedAt: null, declinedAt: null, expiresAt: { gte: since, lt: now } },
      include: { org: { select: { id: true, slug: true, name: true } } },
    });
  }
}
