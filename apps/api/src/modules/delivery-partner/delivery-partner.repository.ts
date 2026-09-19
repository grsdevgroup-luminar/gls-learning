import { Injectable } from "@nestjs/common";
import { Prisma, DeliveryPartnerStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { COURSE_SUMMARY_INCLUDE } from "../courses/course.mapper";
import type { Db } from "../../common/types";

const COURSE_ASSIGNMENT_INCLUDE = {
  course: { include: COURSE_SUMMARY_INCLUDE },
} satisfies Prisma.DeliveryPartnerCourseAssignmentInclude;

export type CourseAssignmentRow = Prisma.DeliveryPartnerCourseAssignmentGetPayload<{
  include: typeof COURSE_ASSIGNMENT_INCLUDE;
}>;

export const partnerSelect = {
  id: true,
  userId: true,
  referralCode: true,
  commissionPercent: true,
  region: true,
  status: true,
  totalEarningsCents: true,
  pendingEarningsCents: true,
  paidEarningsCents: true,
  referralCount: true,
  createdAt: true,
  user: { select: { name: true, email: true } },
} satisfies Prisma.DeliveryPartnerSelect;

export type DeliveryPartnerRow = Prisma.DeliveryPartnerGetPayload<{
  select: typeof partnerSelect;
}>;

@Injectable()
export class DeliveryPartnerRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db) {
    return tx ?? this.prisma;
  }

  findUserByIdOrThrow(userId: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }

  findPendingApplicationByUser(userId: string) {
    return this.prisma.deliveryPartnerApplication.findFirst({
      where: { userId, status: "PENDING" },
    });
  }

  /** Most recent application regardless of status — lets `me()` reflect a
   *  pending or rejected application before any DeliveryPartner row exists (that
   *  row is only created on approval). */
  findLatestApplicationByUser(userId: string) {
    return this.prisma.deliveryPartnerApplication.findFirst({
      where: { userId },
      orderBy: { appliedAt: "desc" },
    });
  }

  createApplication(
    data: Prisma.DeliveryPartnerApplicationUncheckedCreateInput,
  ) {
    return this.prisma.deliveryPartnerApplication.create({ data });
  }

  findApplicationsPage(
    where: Prisma.DeliveryPartnerApplicationWhereInput,
    page: number,
    pageSize: number,
  ) {
    return this.prisma.$transaction([
      this.prisma.deliveryPartnerApplication.findMany({
        where,
        orderBy: { appliedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.deliveryPartnerApplication.count({ where }),
    ]);
  }

  applicationStatusCounts() {
    return this.prisma.$transaction([
      this.prisma.deliveryPartnerApplication.count({ where: { status: "PENDING" } }),
      this.prisma.deliveryPartnerApplication.count({ where: { status: "APPROVED" } }),
      this.prisma.deliveryPartnerApplication.count({ where: { status: "REJECTED" } }),
    ]);
  }

  findApplicationById(appId: string) {
    return this.prisma.deliveryPartnerApplication.findUnique({
      where: { id: appId },
    });
  }

  runTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(fn);
  }

  updateApplication(
    appId: string,
    data: Prisma.DeliveryPartnerApplicationUpdateInput,
    tx?: Db,
  ) {
    return this.db(tx).deliveryPartnerApplication.update({
      where: { id: appId },
      data,
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

  upsertDeliveryPartner(
    userId: string,
    referralCode: string,
    commissionPercent: number,
    tx?: Db,
  ) {
    return this.db(tx).deliveryPartner.upsert({
      where: { userId },
      update: { status: "APPROVED" },
      create: {
        userId,
        referralCode,
        status: "APPROVED",
        commissionPercent,
      },
    });
  }

  findPartnerByUserId(userId: string) {
    return this.prisma.deliveryPartner.findUnique({
      where: { userId },
      select: partnerSelect,
    });
  }

  findPartnerIdByUserId(userId: string) {
    return this.prisma.deliveryPartner.findUnique({
      where: { userId },
      select: { id: true },
    });
  }

  findReferralsByPartner(partnerId: string) {
    return this.prisma.deliveryPartnerReferral.findMany({
      where: { partnerId },
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          include: { user: { select: { name: true } }, items: true },
        },
      },
    });
  }

  findPartnersPage(
    where: Prisma.DeliveryPartnerWhereInput,
    page: number,
    pageSize: number,
  ) {
    return this.prisma.$transaction([
      this.prisma.deliveryPartner.findMany({
        where,
        select: partnerSelect,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.deliveryPartner.count({ where }),
    ]);
  }

  updatePartner(partnerId: string, data: Prisma.DeliveryPartnerUpdateInput) {
    return this.prisma.deliveryPartner.update({
      where: { id: partnerId },
      data,
      select: partnerSelect,
    });
  }

  findPartnerByReferralCode(referralCode: string) {
    return this.prisma.deliveryPartner.findUnique({
      where: { referralCode },
    });
  }

  findOrderTotalById(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      select: { totalCents: true },
    });
  }

  findReferralByOrderId(orderId: string) {
    return this.prisma.deliveryPartnerReferral.findUnique({
      where: { orderId },
      include: { partner: { select: { userId: true } } },
    });
  }

  createPendingReferralTx(
    partnerId: string,
    orderId: string,
    commissionCents: number,
    referralCode: string,
  ) {
    return this.prisma.$transaction([
      this.prisma.deliveryPartnerReferral.create({
        data: { partnerId, orderId, commissionCents, status: "pending" },
      }),
      this.prisma.deliveryPartner.update({
        where: { id: partnerId },
        data: { referralCount: { increment: 1 } },
      }),
      // Stamp the order so reporting can join on partnerId without going through the referral table.
      this.prisma.order.update({
        where: { id: orderId },
        data: { partnerId, partnerReferralCode: referralCode },
      }),
    ]);
  }

  updateApplicationDocuments(applicationId: string, documents: Prisma.InputJsonValue) {
    return this.prisma.deliveryPartnerApplication.update({
      where: { id: applicationId },
      data: { documents },
    });
  }

  confirmReferralTx(
    orderId: string,
    partnerId: string,
    commissionCents: number,
  ) {
    return this.prisma.$transaction([
      this.prisma.deliveryPartnerReferral.update({
        where: { orderId },
        data: { status: "confirmed" },
      }),
      this.prisma.deliveryPartner.update({
        where: { id: partnerId },
        data: {
          pendingEarningsCents: { increment: commissionCents },
          totalEarningsCents: { increment: commissionCents },
        },
      }),
    ]);
  }

  // ── course assignment (admin-only; see DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §3) ──

  findPartnerById(partnerId: string) {
    return this.prisma.deliveryPartner.findUnique({ where: { id: partnerId } });
  }

  /** Precondition check for assignment — mirrors OrganizationsRepository's
   *  identically-named method: a course must be Published before it can be
   *  handed to any partner/org. */
  findCourseStatus(courseId: string) {
    return this.prisma.course.findUnique({
      where: { id: courseId },
      select: { status: true },
    });
  }

  findCourseAssignment(courseId: string, partnerId: string) {
    return this.prisma.deliveryPartnerCourseAssignment.findUnique({
      where: { courseId_partnerId: { courseId, partnerId } },
    });
  }

  createCourseAssignment(courseId: string, partnerId: string, memberCap: number) {
    return this.prisma.deliveryPartnerCourseAssignment.create({
      data: { courseId, partnerId, memberCap },
      include: COURSE_ASSIGNMENT_INCLUDE,
    });
  }

  updateCourseAssignmentCap(id: string, memberCap: number) {
    return this.prisma.deliveryPartnerCourseAssignment.update({
      where: { id },
      data: { memberCap },
      include: COURSE_ASSIGNMENT_INCLUDE,
    });
  }

  deleteCourseAssignment(id: string) {
    return this.prisma.deliveryPartnerCourseAssignment.delete({ where: { id } });
  }

  findCourseAssignmentsForPartner(partnerId: string) {
    return this.prisma.deliveryPartnerCourseAssignment.findMany({
      where: { partnerId },
      include: COURSE_ASSIGNMENT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  findCourseAssignmentById(id: string, tx?: Db) {
    return this.db(tx).deliveryPartnerCourseAssignment.findUnique({
      where: { id },
      include: COURSE_ASSIGNMENT_INCLUDE,
    });
  }

  incrementUsedSeats(assignmentId: string, tx?: Db) {
    return this.db(tx).deliveryPartnerCourseAssignment.update({
      where: { id: assignmentId },
      data: { usedSeats: { increment: 1 } },
    });
  }

  decrementUsedSeats(assignmentId: string) {
    return this.prisma.deliveryPartnerCourseAssignment.update({
      where: { id: assignmentId },
      data: { usedSeats: { decrement: 1 } },
    });
  }

  // ── members + invitations (partner-authenticated; per course assignment) ──

  createInvitation(data: Prisma.DeliveryPartnerInvitationUncheckedCreateInput) {
    return this.prisma.deliveryPartnerInvitation.create({ data });
  }

  /** Public claim-page lookup — includes just enough to render the preview
   *  (course title, partner name) without exposing anything else. */
  findInvitationByToken(token: string) {
    return this.prisma.deliveryPartnerInvitation.findUnique({
      where: { token },
      include: {
        courseAssignment: {
          include: {
            course: { select: { title: true } },
            partner: { include: { user: { select: { name: true } } } },
          },
        },
      },
    });
  }

  findInvitationByTokenPlain(token: string, tx?: Db) {
    return this.db(tx).deliveryPartnerInvitation.findUnique({ where: { token } });
  }

  markInvitationClaimed(token: string, tx?: Db) {
    return this.db(tx).deliveryPartnerInvitation.update({
      where: { token },
      data: { claimedAt: new Date() },
    });
  }

  findActiveInvitationsForAssignment(courseAssignmentId: string) {
    return this.prisma.deliveryPartnerInvitation.findMany({
      where: { courseAssignmentId, claimedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
  }

  findInvitationById(inviteId: string) {
    return this.prisma.deliveryPartnerInvitation.findUnique({ where: { id: inviteId } });
  }

  deleteInvitation(inviteId: string) {
    return this.prisma.deliveryPartnerInvitation.delete({ where: { id: inviteId } });
  }

  upsertMember(
    courseAssignmentId: string,
    userId: string,
    email: string,
    name: string,
    tx?: Db,
  ) {
    return this.db(tx).deliveryPartnerMember.upsert({
      where: { courseAssignmentId_email: { courseAssignmentId, email } },
      update: { userId },
      create: { courseAssignmentId, userId, email, name },
    });
  }

  findMembersForAssignment(courseAssignmentId: string) {
    return this.prisma.deliveryPartnerMember.findMany({
      where: { courseAssignmentId },
      orderBy: { joinedAt: "desc" },
    });
  }

  findMember(memberId: string) {
    return this.prisma.deliveryPartnerMember.findUnique({ where: { id: memberId } });
  }

  deleteMember(memberId: string) {
    return this.prisma.deliveryPartnerMember.delete({ where: { id: memberId } });
  }

  /** Every course a user has access to via a delivery partner — resolved at
   *  read time from membership, same style as OrgMember/CourseOrgAssignment;
   *  no separate access-grant flag to keep in sync. */
  findMemberCoursesForUser(userId: string) {
    return this.prisma.deliveryPartnerMember.findMany({
      where: { userId },
      include: {
        courseAssignment: {
          include: {
            course: { include: COURSE_SUMMARY_INCLUDE },
            partner: { include: { user: { select: { name: true } } } },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });
  }
}
