import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DeliveryPartnerApplication, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { ulid } from "ulid";
import {
  parsePartnerCustomFields,
  parsePartnerDocuments,
} from "@skillstream/shared";
import type {
  AdminDeliveryPartnerApplicationQuery,
  AdminDeliveryPartnerQuery,
  AssignPartnerCourseInput,
  DeliveryPartnerApplicationDto,
  DeliveryPartnerApplicationStatsDto,
  DeliveryPartnerCourseAssignmentDto,
  DeliveryPartnerDto,
  DeliveryPartnerInvitationDto,
  DeliveryPartnerMemberDto,
  DeliveryPartnerReferralDto,
  DeliveryPartnerSignupInput,
  InvitePartnerMemberInput,
  Paginated,
  PartnerDocumentDto,
  PartnerGrantedCourseDto,
  PartnerInvitationInfoDto,
  ReviewPartnerApplicationInput,
  UpdatePartnerCourseAssignmentInput,
  UpdatePartnerInput,
} from "@skillstream/shared";
import type { RequestUser } from "../../common/decorators/decorators";
import { toCourseSummary } from "../courses/course.mapper";
import { EmailService } from "../email/email.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  PARTNER_DOC_KEY_PREFIX,
  PARTNER_DOC_MAX_COUNT,
  STORAGE_DRIVER,
} from "../storage/storage.constants";
import type { StorageDriver } from "../storage/storage.driver";
import {
  DeliveryPartnerRepository,
  type CourseAssignmentRow,
  type DeliveryPartnerRow,
} from "./delivery-partner.repository";
import type { ValidatedPartnerDocFile } from "./pipes/partner-doc-file.pipe";

const INVITE_TTL_MS = 7 * 86_400_000;

@Injectable()
export class DeliveryPartnerService {
  constructor(
    private readonly repo: DeliveryPartnerRepository,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  private toDto(a: DeliveryPartnerRow): DeliveryPartnerDto {
    return {
      id: a.id,
      userId: a.userId,
      name: a.user.name,
      email: a.user.email,
      region: a.region,
      referralCode: a.referralCode,
      commissionPercent: a.commissionPercent,
      status: a.status,
      totalEarningsCents: a.totalEarningsCents,
      pendingEarningsCents: a.pendingEarningsCents,
      paidEarningsCents: a.paidEarningsCents,
      referralCount: a.referralCount,
      createdAt: a.createdAt.toISOString(),
    };
  }

  /** Re-resolves every document's URL through the storage driver on every
   *  read — the key is what's durable; a signed S3 URL minted at upload time
   *  may have expired by the time an admin opens the application. */
  private async toAppDto(
    a: DeliveryPartnerApplication,
  ): Promise<DeliveryPartnerApplicationDto> {
    const documents = parsePartnerDocuments(a.documents);
    const resolved: PartnerDocumentDto[] = await Promise.all(
      documents.map(async (d) => ({
        ...d,
        url: await this.storage.getUrl(d.key).catch(() => ""),
      })),
    );
    return {
      id: a.id,
      name: a.name,
      email: a.email,
      country: a.country,
      customFields: parsePartnerCustomFields(a.customFields),
      documents: resolved,
      expectedCommissionPercent: a.expectedCommissionPercent,
      status: a.status,
      appliedAt: a.appliedAt.toISOString(),
      reviewedAt: a.reviewedAt?.toISOString() ?? null,
      note: a.note,
    };
  }

  private toAssignmentDto(a: CourseAssignmentRow): DeliveryPartnerCourseAssignmentDto {
    return {
      id: a.id,
      partnerId: a.partnerId,
      course: toCourseSummary(a.course),
      memberCap: a.memberCap,
      usedSeats: a.usedSeats,
      createdAt: a.createdAt.toISOString(),
    };
  }

  // ── application ──────────────────────────────────────────────────────────
  /** The only way to create an application — always as part of the combined
   *  signup+apply step (`createSignupApplication`, called right after a brand
   *  new account is created). An existing account cannot self-initiate one;
   *  see DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §2 for why. */
  private createApplicationRecord(
    userId: string,
    name: string,
    email: string,
    input: DeliveryPartnerSignupInput,
  ) {
    return this.repo.createApplication({
      userId,
      name,
      email,
      country: input.country,
      customFields: input.customFields as Prisma.InputJsonValue,
      expectedCommissionPercent: input.expectedCommissionPercent ?? null,
      status: "PENDING",
    });
  }

  /** Used by the dedicated delivery-partner signup journey (AuthService,
   *  right after the account is created) — a brand-new user can't already
   *  have a pending application, so this skips straight to creating it. */
  async createSignupApplication(
    userId: string,
    name: string,
    email: string,
    input: DeliveryPartnerSignupInput,
  ): Promise<void> {
    await this.createApplicationRecord(userId, name, email, input);
  }

  /** The caller's own latest application, in full (customFields + resolved
   *  document URLs) — powers the public status page. */
  async myApplication(user: RequestUser): Promise<DeliveryPartnerApplicationDto | null> {
    const app = await this.repo.findLatestApplicationByUser(user.id);
    if (!app) return null;
    return this.toAppDto(app);
  }

  private async findPendingApplicationOrThrow(userId: string) {
    const app = await this.repo.findPendingApplicationByUser(userId);
    if (!app) throw new BadRequestException("No pending application to attach documents to");
    return app;
  }

  async uploadDocument(
    user: RequestUser,
    title: string,
    file: ValidatedPartnerDocFile,
  ): Promise<PartnerDocumentDto> {
    const app = await this.findPendingApplicationOrThrow(user.id);
    const documents = parsePartnerDocuments(app.documents);
    if (documents.length >= PARTNER_DOC_MAX_COUNT) {
      throw new BadRequestException(`You can attach up to ${PARTNER_DOC_MAX_COUNT} documents`);
    }

    const key = `${PARTNER_DOC_KEY_PREFIX}/${user.id}/${ulid()}.${file.extension}`;
    const stored = await this.storage.put({
      key,
      body: file.buffer,
      contentType: file.mimeType,
      contentLength: file.size,
      originalName: file.originalName,
    });
    const doc = {
      title: title.trim(),
      key: stored.key,
      name: file.originalName,
      sizeLabel: humanSize(file.size),
    };
    await this.repo.updateApplicationDocuments(
      app.id,
      [...documents, doc] as Prisma.InputJsonValue,
    );
    return { ...doc, url: stored.url };
  }

  /** Mirrors InstructorService.latestApplicationStatus — lets AuthService
   *  resolve AuthUserDto.deliveryPartnerStatus without a second round trip
   *  from the frontend. */
  async latestApplicationStatus(
    userId: string,
  ): Promise<DeliveryPartnerApplicationDto["status"] | null> {
    const app = await this.repo.findLatestApplicationByUser(userId);
    return app?.status ?? null;
  }

  // ── partner self ─────────────────────────────────────────────────────────
  /** A DeliveryPartner row only exists once an application is approved, so
   *  a pending or rejected applicant would otherwise see `null` here and the
   *  frontend would show the apply form again instead of their status. */
  async me(user: RequestUser): Promise<DeliveryPartnerDto | null> {
    const a = await this.repo.findPartnerByUserId(user.id);
    if (a) return this.toDto(a);

    const app = await this.repo.findLatestApplicationByUser(user.id);
    if (!app || app.status === "APPROVED") return null;

    return {
      id: app.id,
      userId: user.id,
      name: app.name,
      email: app.email,
      region: "",
      referralCode: "",
      commissionPercent: 0,
      status: app.status,
      totalEarningsCents: 0,
      pendingEarningsCents: 0,
      paidEarningsCents: 0,
      referralCount: 0,
      createdAt: app.appliedAt.toISOString(),
    };
  }

  async myReferrals(user: RequestUser): Promise<DeliveryPartnerReferralDto[]> {
    const partner = await this.repo.findPartnerIdByUserId(user.id);
    if (!partner) return [];
    return this.referralsForPartner(partner.id);
  }

  private async referralsForPartner(partnerId: string): Promise<DeliveryPartnerReferralDto[]> {
    const rows = await this.repo.findReferralsByPartner(partnerId);
    return rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      partnerId: r.partnerId,
      studentName: r.order.user.name,
      courseTitle: r.order.items.map((i) => i.titleSnapshot).join(", "),
      orderTotalCents: r.order.totalCents,
      commissionCents: r.commissionCents,
      reversedCents: r.reversedCents,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  // ── course assignments + members (partner-authenticated) ─────────────────
  /** A suspended (or otherwise non-approved) partner keeps their `DeliveryPartner`
   *  row, but every self-service action must stop working immediately — the
   *  frontend already hides these, but that's cosmetic only, so it's enforced
   *  here too. */
  async myCourseAssignments(user: RequestUser): Promise<DeliveryPartnerCourseAssignmentDto[]> {
    const partner = await this.repo.findPartnerByUserId(user.id);
    if (!partner || partner.status !== "APPROVED") return [];
    return this.listCourseAssignments(partner.id);
  }

  /** Confirms the caller actually owns this course assignment before letting
   *  them invite/list/remove against it — every partner-authenticated
   *  endpoint below goes through this first. Returns the full partner row
   *  (not just its id) since inviteMember needs the partner's name for the
   *  invite email. Also re-checks `status === APPROVED` here (not just at the
   *  page level) so a suspended partner can't keep managing members via a
   *  direct API call once their dashboard access is revoked. */
  private async assertOwnAssignment(user: RequestUser, courseAssignmentId: string) {
    const partner = await this.repo.findPartnerByUserId(user.id);
    if (!partner) throw new ForbiddenException("Not a delivery partner");
    if (partner.status !== "APPROVED") {
      throw new ForbiddenException("Your delivery partner account is not active");
    }
    const assignment = await this.repo.findCourseAssignmentById(courseAssignmentId);
    if (!assignment || assignment.partnerId !== partner.id) {
      throw new NotFoundException("Course assignment not found");
    }
    return { partner, assignment };
  }

  async inviteMember(
    user: RequestUser,
    courseAssignmentId: string,
    input: InvitePartnerMemberInput,
  ): Promise<DeliveryPartnerInvitationDto> {
    const { partner, assignment } = await this.assertOwnAssignment(user, courseAssignmentId);
    if (assignment.usedSeats >= assignment.memberCap) {
      throw new BadRequestException("No seats remaining for this course");
    }
    const email = input.email.toLowerCase();
    const token = randomUUID();
    const invitation = await this.repo.createInvitation({
      courseAssignmentId,
      email,
      token,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
    // Deliver the join link. Non-blocking, same as OrganizationsService.invite
    // — the partner still gets the invitation (with token) back so the link
    // can be copied if email delivery fails.
    this.email
      .sendPartnerMemberInvite(email, partner.user.name, assignment.course.title, token)
      .catch(() => {});
    return {
      id: invitation.id,
      courseAssignmentId: invitation.courseAssignmentId,
      email: invitation.email,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    };
  }

  async listInvitations(
    user: RequestUser,
    courseAssignmentId: string,
  ): Promise<DeliveryPartnerInvitationDto[]> {
    await this.assertOwnAssignment(user, courseAssignmentId);
    const rows = await this.repo.findActiveInvitationsForAssignment(courseAssignmentId);
    return rows.map((r) => ({
      id: r.id,
      courseAssignmentId: r.courseAssignmentId,
      email: r.email,
      expiresAt: r.expiresAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async listMembers(
    user: RequestUser,
    courseAssignmentId: string,
  ): Promise<DeliveryPartnerMemberDto[]> {
    await this.assertOwnAssignment(user, courseAssignmentId);
    const rows = await this.repo.findMembersForAssignment(courseAssignmentId);
    return rows.map((r) => ({
      id: r.id,
      courseAssignmentId: r.courseAssignmentId,
      userId: r.userId,
      name: r.name,
      email: r.email,
      joinedAt: r.joinedAt.toISOString(),
    }));
  }

  async revokeInvitation(user: RequestUser, inviteId: string): Promise<{ ok: true }> {
    const invite = await this.repo.findInvitationById(inviteId);
    if (!invite) throw new NotFoundException("Invitation not found");
    await this.assertOwnAssignment(user, invite.courseAssignmentId);
    await this.repo.deleteInvitation(inviteId);
    return { ok: true };
  }

  async removeMember(user: RequestUser, memberId: string): Promise<{ ok: true }> {
    const member = await this.repo.findMember(memberId);
    if (!member) throw new NotFoundException("Member not found");
    const { assignment } = await this.assertOwnAssignment(user, member.courseAssignmentId);
    await this.repo.deleteMember(memberId);
    await this.repo.decrementUsedSeats(assignment.id);
    return { ok: true };
  }

  // ── invitation claim (public preview + authenticated accept) ─────────────
  /** Public: minimal invitation info for the join page (prefill + validity).
   *  The token is an unguessable secret, so returning the invited email is safe. */
  async invitationInfo(token: string): Promise<PartnerInvitationInfoDto> {
    const invite = await this.repo.findInvitationByToken(token);
    const valid = !!invite && !invite.claimedAt && invite.expiresAt > new Date();
    return {
      valid,
      email: invite?.email ?? null,
      courseTitle: invite?.courseAssignment.course.title ?? null,
      partnerName: invite?.courseAssignment.partner.user.name ?? null,
    };
  }

  /** A logged-in user claims an invitation, becoming a member of that one
   *  course assignment + consuming a seat. Access itself is resolved at read
   *  time (see findMemberCoursesForUser) — no separate grant flag. */
  async claimInvitation(user: RequestUser, token: string): Promise<DeliveryPartnerCourseAssignmentDto> {
    const invite = await this.repo.findInvitationByTokenPlain(token);
    if (!invite || invite.claimedAt || invite.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired invitation");
    }
    const dbUser = await this.repo.findUserByIdOrThrow(user.id);

    const assignment = await this.repo.runTransaction(async (tx) => {
      const current = await this.repo.findCourseAssignmentById(invite.courseAssignmentId, tx);
      if (!current) throw new NotFoundException("Course assignment not found");
      if (current.usedSeats >= current.memberCap) {
        throw new BadRequestException("This course is full");
      }
      await this.repo.upsertMember(invite.courseAssignmentId, user.id, dbUser.email, dbUser.name, tx);
      await this.repo.incrementUsedSeats(invite.courseAssignmentId, tx);
      await this.repo.markInvitationClaimed(token, tx);
      return current;
    });

    return this.toAssignmentDto(assignment);
  }

  /** Every course the current user has access to via a delivery partner —
   *  powers the member-facing "granted courses" page (kept separate from
   *  /dashboard/team on purpose, see DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §6.3). */
  async myGrantedCourses(user: RequestUser): Promise<PartnerGrantedCourseDto[]> {
    const rows = await this.repo.findMemberCoursesForUser(user.id);
    return rows.map((r) => ({
      courseAssignmentId: r.courseAssignmentId,
      partnerName: r.courseAssignment.partner.user.name,
      course: toCourseSummary(r.courseAssignment.course),
      joinedAt: r.joinedAt.toISOString(),
      partnerSuspended: r.courseAssignment.partner.status !== "APPROVED",
    }));
  }

  // ── admin ──────────────────────────────────────────────────────────────
  async listApplications(
    query: AdminDeliveryPartnerApplicationQuery,
  ): Promise<Paginated<DeliveryPartnerApplicationDto>> {
    const where: Prisma.DeliveryPartnerApplicationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { email: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.repo.findApplicationsPage(
      where,
      query.page,
      query.pageSize,
    );
    return {
      items: await Promise.all(rows.map((a) => this.toAppDto(a))),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async applicationStats(): Promise<DeliveryPartnerApplicationStatsDto> {
    const [pending, approved, rejected] = await this.repo.applicationStatusCounts();
    return { pending, approved, rejected };
  }

  async listPartners(query: AdminDeliveryPartnerQuery): Promise<Paginated<DeliveryPartnerDto>> {
    const where: Prisma.DeliveryPartnerWhereInput = query.q
      ? {
          OR: [
            { referralCode: { contains: query.q, mode: "insensitive" } },
            { user: { name: { contains: query.q, mode: "insensitive" } } },
            { user: { email: { contains: query.q, mode: "insensitive" } } },
          ],
        }
      : {};
    const [rows, total] = await this.repo.findPartnersPage(where, query.page, query.pageSize);
    return {
      items: rows.map((a) => this.toDto(a)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async updatePartner(partnerId: string, input: UpdatePartnerInput): Promise<DeliveryPartnerDto> {
    const a = await this.repo.updatePartner(partnerId, {
      commissionPercent: input.commissionPercent,
      status: input.status,
    });
    return this.toDto(a);
  }

  async reviewApplication(
    appId: string,
    input: ReviewPartnerApplicationInput,
  ): Promise<DeliveryPartnerApplicationDto> {
    const app = await this.repo.findApplicationById(appId);
    if (!app) throw new NotFoundException("Application not found");

    const result = await this.repo.runTransaction(async (tx) => {
      const updated = await this.repo.updateApplication(
        appId,
        { status: input.status, reviewedAt: new Date(), note: input.note },
        tx,
      );
      if (input.status === "APPROVED" && app.userId) {
        await this.repo.updateUserRole(app.userId, "DELIVERY_PARTNER", tx);
        await this.repo.upsertDeliveryPartner(
          app.userId,
          this.generateCode(),
          input.commissionPercent ?? 10,
          tx,
        );
      }
      return updated;
    });

    if (app.userId) {
      const approved = result.status === "APPROVED";
      const approvedBody = result.note
        ? `You're approved as a delivery partner — your referral code is ready. ${result.note}`
        : "You're approved as a delivery partner — your referral code is ready.";
      void this.notifications
        .notify({
          userId: app.userId,
          event: approved
            ? "DELIVERY_PARTNER_APPLICATION_APPROVED"
            : "DELIVERY_PARTNER_APPLICATION_REJECTED",
          title: approved ? "Delivery partner application approved" : "Delivery partner application update",
          body: approved
            ? approvedBody
            : (result.note ?? "Your delivery partner application was not approved this time."),
          href: approved ? "/delivery-partner/referrals" : "/partner",
        })
        .catch(() => undefined);
    }

    return this.toAppDto(result);
  }

  private generateCode(): string {
    return `REF-${randomUUID().slice(0, 6).toUpperCase()}`;
  }

  // ── course assignment (admin-only; mirrors OrganizationsService's) ───────
  /** Sets the per-course member cap at assignment time (decision #4/#5 in
   *  DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §3) — unlike org seats, this is
   *  scoped to one course-assignment, not the whole partner. */
  async assignCourse(
    partnerId: string,
    input: AssignPartnerCourseInput,
  ): Promise<DeliveryPartnerCourseAssignmentDto> {
    const partner = await this.repo.findPartnerById(partnerId);
    if (!partner) throw new NotFoundException("Delivery partner not found");
    const course = await this.repo.findCourseStatus(input.courseId);
    if (!course) throw new NotFoundException("Course not found");
    if (course.status !== "PUBLISHED") {
      throw new BadRequestException("Publish this course before assigning it to a delivery partner");
    }
    if (await this.repo.findCourseAssignment(input.courseId, partnerId)) {
      throw new BadRequestException("This course is already assigned to this partner");
    }
    const row = await this.repo.createCourseAssignment(input.courseId, partnerId, input.memberCap);
    return this.toAssignmentDto(row);
  }

  async listCourseAssignments(partnerId: string): Promise<DeliveryPartnerCourseAssignmentDto[]> {
    const rows = await this.repo.findCourseAssignmentsForPartner(partnerId);
    return rows.map((r) => this.toAssignmentDto(r));
  }

  async updateCourseAssignment(
    partnerId: string,
    courseId: string,
    input: UpdatePartnerCourseAssignmentInput,
  ): Promise<DeliveryPartnerCourseAssignmentDto> {
    const assignment = await this.repo.findCourseAssignment(courseId, partnerId);
    if (!assignment) throw new NotFoundException("Course is not assigned to this partner");
    const row = await this.repo.updateCourseAssignmentCap(assignment.id, input.memberCap);
    return this.toAssignmentDto(row);
  }

  async unassignCourse(partnerId: string, courseId: string): Promise<{ ok: true }> {
    const assignment = await this.repo.findCourseAssignment(courseId, partnerId);
    if (!assignment) throw new NotFoundException("Course is not assigned to this partner");
    await this.repo.deleteCourseAssignment(assignment.id);
    return { ok: true };
  }

  // ── referral attribution (called from checkout / fulfillment) ───────────
  /** Resolves a `?ref=` code captured at signup to an APPROVED partner's id,
   *  or null if the code is unknown/invalid/not approved — called by
   *  AuthService.register() to set the durable User.referredByPartnerId.
   *  Never throws: a bad referral code should never block signup. */
  async resolveApprovedPartnerIdByCode(referralCode: string): Promise<string | null> {
    const partner = await this.repo.findPartnerByReferralCode(referralCode);
    return partner && partner.status === "APPROVED" ? partner.id : null;
  }

  /** Durable, signup-time attribution (`User.referredByPartnerId`) always wins
   *  over a later `?ref=` click carried into checkout — first touch, locked
   *  in once at registration, so a customer can't be silently re-attributed
   *  to a different partner later. The checkout-supplied code is only a
   *  fallback for accounts that predate this attribution field. */
  private async resolveReferralPartner(
    userId: string,
    checkoutReferralCode?: string | null,
  ) {
    const user = await this.repo.findUserReferralAttribution(userId);
    if (user?.referredByPartnerId) {
      const partner = await this.repo.findPartnerById(user.referredByPartnerId);
      if (partner && partner.status === "APPROVED") return partner;
    }
    if (checkoutReferralCode) {
      const partner = await this.repo.findPartnerByReferralCode(checkoutReferralCode);
      if (partner && partner.status === "APPROVED") return partner;
    }
    return null;
  }

  /** Attaches a pending referral to a freshly-created order. No earnings are
   *  credited until the order is paid (see confirmReferral). */
  async createPendingReferral(
    orderId: string,
    userId: string,
    checkoutReferralCode?: string | null,
  ): Promise<void> {
    const partner = await this.resolveReferralPartner(userId, checkoutReferralCode);
    if (!partner) return;

    const order = await this.repo.findOrderTotalById(orderId);
    if (!order) return;

    const exists = await this.repo.findReferralByOrderId(orderId);
    if (exists) return;

    const commissionCents = Math.round(
      order.totalCents * (partner.commissionPercent / 100),
    );
    await this.repo.createPendingReferralTx(
      partner.id,
      orderId,
      commissionCents,
      partner.referralCode,
    );
  }

  /** Confirms a referral once its order is paid, crediting the partner's
   *  pending/total earnings. Idempotent. */
  async confirmReferral(orderId: string): Promise<void> {
    const referral = await this.repo.findReferralByOrderId(orderId);
    if (!referral || referral.status !== "PENDING") return;
    await this.repo.confirmReferralTx(
      orderId,
      referral.partnerId,
      referral.commissionCents,
    );
    void this.notifications
      .notify({
        userId: referral.partner.userId,
        event: "REFERRAL_CONFIRMED",
        title: "Referral confirmed",
        body: `A referral you sent just converted — $${(referral.commissionCents / 100).toFixed(2)} commission pending.`,
        href: "/delivery-partner/referrals",
      })
      .catch(() => undefined);
  }
}

/** Bytes → "1.2 MB" style. Mirrors the identical helper in InstructorService. */
function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIdx]}`;
}
