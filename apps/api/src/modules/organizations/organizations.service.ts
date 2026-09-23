import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import * as argon2 from "argon2";
import { Prisma } from "@prisma/client";
import { isOrgAccessLocked } from "@skillstream/shared";
import type {
  AssignOrgCourseInput,
  CreateOrganizationInput,
  CreateOrganizationResultDto,
  InviteOrgMemberInput,
  OrganizationDto,
  UpdateOrganizationInput,
} from "@skillstream/shared";
import type { RequestUser } from "../../common/decorators/decorators";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import {
  NotificationsService,
  type NotifyInput,
} from "../notifications/notifications.service";
import { toCourseSummary } from "../courses/course.mapper";
import {
  OrganizationsRepository,
  type OrgRow,
} from "./organizations.repository";

const TEMP_PASSWORD_CHARS =
  "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";

function generateTempPassword(length = 14): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += TEMP_PASSWORD_CHARS[bytes[i] % TEMP_PASSWORD_CHARS.length];
  }
  return `${out}Aa1!`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: OrganizationsRepository,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
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
      suspensionMode: o.suspensionMode,
      accessLocksAt: o.accessLocksAt?.toISOString() ?? null,
      accessLocked: isOrgAccessLocked({
        status: o.status,
        accessLocksAt: o.accessLocksAt,
      }),
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
      assignedCourseCount: o._count.courseAssignments,
    };
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = slugify(base) || "org";
    let n = 2;
    while (await this.repo.findOrgBySlug(slug)) {
      slug = `${slugify(base) || "org"}-${n++}`;
    }
    return slug;
  }

  /** Platform ADMIN can manage any org; an org's own ADMIN member can manage
   *  it — unless the org's access is currently locked by suspension, which
   *  even its own admin cannot lift (only the platform can reactivate). */
  private async assertOrgAdmin(user: RequestUser, idOrSlug: string): Promise<string> {
    const org = await this.getRow(idOrSlug);
    if (user.role === "ADMIN") return org.id;
    const member = await this.repo.findAdminMembership(org.id, user.id);
    if (!member) throw new ForbiddenException("Not an admin of this organization");
    if (isOrgAccessLocked(org))
      throw new ForbiddenException("This organization's access is currently suspended");
    return org.id;
  }

  /** Which courses a company gets is a platform decision, not something a
   *  customer's own admin can grant themselves — same policy as seats/status. */
  private async assertPlatformAdmin(user: RequestUser, idOrSlug: string) {
    if (user.role !== "ADMIN")
      throw new ForbiddenException(
        "Course assignments are managed by SkillStream — contact support",
      );
    return this.getRow(idOrSlug);
  }

  /** Accepts either the org id or its slug (the web app routes by slug). */
  private getRow(idOrSlug: string) {
    return this.repo.findOrgBySlugOrId(idOrSlug).catch(() => {
      throw new NotFoundException("Organization not found");
    });
  }

  // ── platform admin ───────────────────────────────────────────────────────
  /**
   * Creates the org and provisions its admin account directly — a temp
   * password + a "your organization is ready" email, not the self-service
   * invite/claim flow ordinary members use. The slug is generated from the
   * name; admins never type one.
   */
  async create(input: CreateOrganizationInput): Promise<CreateOrganizationResultDto> {
    const adminEmail = input.adminEmail.toLowerCase();
    if (await this.repo.findUserByEmail(adminEmail))
      throw new BadRequestException(
        "This email already has a SkillStream account — use a different admin email",
      );

    const slug = await this.uniqueSlug(input.name);
    const tempPassword = generateTempPassword();
    const passwordHash = await argon2.hash(tempPassword, { type: argon2.argon2id });
    const adminName = input.adminName?.trim() || adminEmail.split("@")[0];

    const org = await this.prisma.$transaction((tx) =>
      this.repo.createOrganizationWithAdmin(
        {
          name: input.name,
          slug,
          domain: input.domain,
          adminEmail,
          seatCount: input.seatCount,
          status: "TRIAL",
        },
        { email: adminEmail, name: adminName, passwordHash },
        tx,
      ),
    );

    let credentialsEmailSent = true;
    try {
      await this.email.sendOrgAdminCredentials(adminEmail, adminName, org.name, tempPassword);
    } catch {
      credentialsEmailSent = false;
    }

    return { ...this.toDto(org), tempPassword, credentialsEmailSent };
  }

  async list(): Promise<OrganizationDto[]> {
    const rows = await this.repo.findManyOrganizations();
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
    if (
      user.role !== "ADMIN" &&
      (input.seatCount !== undefined ||
        input.status !== undefined ||
        input.suspensionMode !== undefined ||
        input.graceDays !== undefined)
    )
      throw new ForbiddenException(
        "Seat count and status are managed by SkillStream — contact support",
      );

    const { suspensionMode, graceDays, ...rest } = input;
    const data: Prisma.OrganizationUpdateInput = { ...rest };
    if (input.status === "SUSPENDED") {
      const mode = suspensionMode ?? "LOCK_NOW";
      if (mode === "GRACE_PERIOD" && !graceDays)
        throw new BadRequestException("graceDays is required for a grace-period suspension");
      data.suspensionMode = mode;
      data.accessLocksAt =
        mode === "GRACE_PERIOD"
          ? new Date(Date.now() + graceDays! * 86_400_000)
          : new Date();
    } else if (input.status === "ACTIVE" || input.status === "TRIAL") {
      data.suspensionMode = null;
      data.accessLocksAt = null;
    }

    await this.repo.updateOrganization(orgId, data);
    return this.toDto(await this.getRow(orgId));
  }

  // ── members / invitations ─────────────────────────────────────────────────
  async invite(user: RequestUser, idOrSlug: string, input: InviteOrgMemberInput) {
    const orgId = await this.assertOrgAdmin(user, idOrSlug);
    const org = await this.getRow(orgId);
    if (org.usedSeats >= org.seatCount)
      throw new BadRequestException("No seats remaining");
    const token = randomUUID();
    const email = input.email.toLowerCase();
    const invitation = await this.repo.createInvitation({
      orgId,
      email,
      role: input.role,
      token,
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    });
    // Deliver the join link. Non-blocking: the admin still gets the invitation
    // (with token) back so the link can be copied if email delivery fails.
    this.email
      .sendOrgInvite(invitation.email, org.name, invitation.role, token)
      .catch(() => {});
    // If the invited email already belongs to a platform user, also surface
    // the invite in their in-app notification feed, not just via email.
    const existingUser = await this.repo.findUserByEmail(email);
    if (existingUser) {
      this.notifications
        .notify({
          userId: existingUser.id,
          event: "ORG_INVITE_RECEIVED",
          title: "Organization invitation",
          body: `You've been invited to join ${org.name} as ${input.role === "ADMIN" ? "an admin" : "a member"}.`,
          href: `/join/${token}`,
          skipEmail: true, // the invite email above already covers delivery
        })
        .catch(() => {});
    }
    return invitation;
  }

  /** Public: minimal invitation info for the join page (prefill + validity).
   *  The token is an unguessable secret, so returning the invited email is safe. */
  async invitationInfo(token: string) {
    const invite = await this.repo.findInvitationByToken(token);
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
    const invite = await this.repo.findInvitationByTokenPlain(token);
    if (!invite || invite.claimedAt || invite.expiresAt < new Date())
      throw new BadRequestException("Invalid or expired invitation");

    const dbUser = await this.repo.findUserByIdOrThrow(user.id);

    // Built inside the transaction, sent after it commits — see
    // NotificationsService's notify()/notifyEmailAfterCommit() split.
    const seatWarning: NotifyInput[] = [];

    await this.prisma.$transaction(async (tx) => {
      const org = await this.repo.findOrgByIdOrThrow(invite.orgId, tx);
      if (org.usedSeats >= org.seatCount)
        throw new BadRequestException("Organization is full");

      await this.repo.upsertOrgMember(
        invite.orgId,
        user.id,
        dbUser.email,
        dbUser.name,
        invite.role,
        tx,
      );
      await this.repo.incrementUsedSeats(invite.orgId, tx);
      await this.repo.markInvitationClaimed(token, tx);
      if (invite.role === "ADMIN")
        await this.repo.updateUserRole(user.id, "ORG_ADMIN", tx);

      const admins = (await this.repo.findOrgAdminUserIds(invite.orgId, tx))
        .map((m) => m.userId!)
        .filter((id) => id !== user.id);

      for (const adminId of admins) {
        await this.notifications.notify(
          {
            userId: adminId,
            event: "ORG_MEMBER_JOINED",
            title: "New team member",
            body: `${dbUser.name} joined ${org.name}.`,
            href: `/org/${org.slug}/members`,
            skipEmail: true, // in-app only, P2 — see Phase 3 taxonomy
          },
          tx,
        );
      }

      // Notify once per threshold crossed by *this* join, not on every join
      // once already over it.
      const updatedSeats = org.usedSeats + 1;
      const nearingAt = Math.ceil(org.seatCount * 0.8);
      const justFilled = org.usedSeats < org.seatCount && updatedSeats >= org.seatCount;
      const justNearing =
        !justFilled && org.usedSeats < nearingAt && updatedSeats >= nearingAt;

      if (justFilled || justNearing) {
        const body = justFilled
          ? `${org.name} is out of seats (${updatedSeats}/${org.seatCount} used).`
          : `${org.name} is nearing its seat limit (${updatedSeats}/${org.seatCount} used).`;
        for (const adminId of admins) {
          const input: NotifyInput = {
            userId: adminId,
            event: "ORG_SEATS_LOW",
            title: justFilled ? "Seats full" : "Seats running low",
            body,
            href: `/org/${org.slug}/members`,
          };
          await this.notifications.notify(input, tx);
          seatWarning.push(input);
        }
      }
    });

    for (const input of seatWarning) {
      void this.notifications.notifyEmailAfterCommit(input).catch(() => undefined);
    }

    return this.toDto(await this.getRow(invite.orgId));
  }

  async removeMember(user: RequestUser, idOrSlug: string, memberId: string) {
    const orgId = await this.assertOrgAdmin(user, idOrSlug);
    const member = await this.repo.findMember(memberId, orgId);
    if (!member) throw new NotFoundException("Member not found");
    if (member.role === "ADMIN") {
      const admins = await this.repo.countAdmins(orgId);
      if (admins <= 1)
        throw new BadRequestException("An organization must keep one admin");
    }
    await this.repo.deleteMember(memberId);
    await this.repo.decrementUsedSeats(orgId);
    return this.toDto(await this.getRow(orgId));
  }

  // ── course assignment (many-to-many; public or private, admin only) ───────
  /** Assignment is pure distribution/curation — it never changes a course's
   *  visibility. A course must be Published (regardless of Public/Private)
   *  so an org's list never shows a broken "Enroll" button. */
  async assignCourse(
    user: RequestUser,
    idOrSlug: string,
    input: AssignOrgCourseInput,
  ): Promise<OrganizationDto> {
    const org = await this.assertPlatformAdmin(user, idOrSlug);
    const course = await this.repo.findCourseStatus(input.courseId);
    if (!course) throw new NotFoundException("Course not found");
    if (course.status !== "PUBLISHED")
      throw new BadRequestException("Publish this course before assigning it to an organization");
    if (await this.repo.findCourseInOrg(input.courseId, org.id))
      throw new BadRequestException("This course is already assigned to this organization");
    await this.repo.assignCourseToOrg(input.courseId, org.id);
    return this.toDto(await this.getRow(org.id));
  }

  /** Detach a course from this org — a Private course stays Private (it may
   *  still be assigned to other orgs); visibility is never touched here. */
  async unassignCourse(
    user: RequestUser,
    idOrSlug: string,
    courseId: string,
  ): Promise<OrganizationDto> {
    const org = await this.assertPlatformAdmin(user, idOrSlug);
    const course = await this.repo.findCourseInOrg(courseId, org.id);
    if (!course) throw new NotFoundException("Course is not assigned to this organization");
    await this.repo.unassignCourseFromOrg(courseId, org.id);
    return this.toDto(await this.getRow(org.id));
  }

  // ── invitation management ─────────────────────────────────────────────────
  async listInvitations(user: RequestUser, idOrSlug: string) {
    const orgId = await this.assertOrgAdmin(user, idOrSlug);
    return this.repo.findActiveInvitations(orgId);
  }

  async revokeInvitation(user: RequestUser, idOrSlug: string, inviteId: string) {
    const orgId = await this.assertOrgAdmin(user, idOrSlug);
    const invite = await this.repo.findInvitationById(inviteId);
    if (!invite || invite.orgId !== orgId)
      throw new NotFoundException("Invitation not found");
    await this.repo.deleteInvitation(inviteId);
    return { ok: true as const };
  }

  /** Courses assigned to an org — visible to any member (or platform admin),
   *  unless the org's access is currently locked by suspension. */
  async listCourses(user: RequestUser, idOrSlug: string) {
    const org = await this.getRow(idOrSlug);
    if (user.role !== "ADMIN") {
      const member = await this.repo.findOrgMembership(org.id, user.id);
      if (!member) throw new ForbiddenException("Not a member of this organization");
      if (isOrgAccessLocked(org))
        throw new ForbiddenException("This organization's access is currently suspended");
    }
    const rows = await this.repo.findOrgCourses(org.id);
    return rows.map(toCourseSummary);
  }

  /** Orgs the current user belongs to (for the member/org-admin portal). */
  async myOrganizations(user: RequestUser): Promise<OrganizationDto[]> {
    const memberships = await this.repo.findUserMemberships(user.id);
    if (!memberships.length) return [];
    const rows = await this.repo.findOrganizationsByIds(
      memberships.map((m) => m.orgId),
    );
    return rows.map((o) => this.toDto(o));
  }

  // ── scheduled ─────────────────────────────────────────────────────────────
  /** Nightly sweep (MaintenanceProcessor) — invitations that expired unclaimed
   *  since the last run. In-app only; no email, matching the Phase 3 taxonomy. */
  async checkExpiredInvitations(sinceHoursAgo = 25): Promise<void> {
    const now = new Date();
    const since = new Date(now.getTime() - sinceHoursAgo * 3600_000);
    const expired = await this.repo.findRecentlyExpiredUnclaimedInvitations(since, now);

    for (const invite of expired) {
      const admins = (await this.repo.findOrgAdminUserIds(invite.orgId))
        .map((m) => m.userId!);
      for (const adminId of admins) {
        await this.notifications.notify({
          userId: adminId,
          event: "ORG_INVITE_EXPIRED",
          title: "Invite expired",
          body: `The invite to ${invite.email} for ${invite.org.name} expired unclaimed.`,
          href: `/org/${invite.org.slug}/members`,
          skipEmail: true,
        });
      }
    }
  }
}
