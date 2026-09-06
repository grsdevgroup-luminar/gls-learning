import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AutomationRule, Coupon, PlatformSettings, Prisma } from "@prisma/client";
import type {
  AdminAnalyticsDto,
  AdminCourseQuery,
  AdminCourseStatsDto,
  AdminOrderStatsDto,
  AdminOverviewDto,
  AdminStudentDto,
  AdminStudentProfileDto,
  AdminStudentStatsDto,
  AutomationRuleDto,
  CouponDto,
  Paginated,
  PlatformSettingsDto,
  SearchQuery,
  UpdatePlatformSettingsInput,
  ReminderLogDto,
  OrderDto,
  PatchCouponInput,
  RefundOrderInput,
  UpsertAutomationRuleInput,
  UpsertCouponInput,
  UpdateUserStatusInput,
} from "@skillstream/shared";
import { toCourseSummary } from "../courses/course.mapper";
import { CreditsService } from "../credits/credits.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AdminRepository } from "./admin.repository";

/** Settings are a single pinned row (see the PlatformSettings model). */
const SETTINGS_ID = "singleton";

/** Normalized refund action derived from RefundOrderInput + the live order.
 *  `entries` mirrors input.items but resolved against the order's current
 *  refundedCents so downstream writes don't need to re-query. */
interface RefundPlan {
  entries: {
    itemId: string;
    courseId: string;
    titleSnapshot: string;
    priceCents: number;
    amountCents: number;
    /** True when this item's cumulative refundedCents will hit priceCents
     *  after this action — access to that course should be revoked. */
    fullyRefundedAfter: boolean;
  }[];
  total: number;
  newOrderRefunded: number;
  status: "PARTIALLY_REFUNDED" | "REFUNDED";
}

@Injectable()
export class AdminService {
  constructor(
    private readonly repo: AdminRepository,
    private readonly credits: CreditsService,
    private readonly notifications: NotificationsService,
  ) {}

  async overview(): Promise<AdminOverviewDto> {
    const [
      revenue,
      enrollments,
      completedEnrollments,
      students,
      instructors,
      publishedCourses,
      paidOrders,
      refundedOrders,
    ] = await this.repo.overviewCounts();

    const completionRatePct = enrollments
      ? Math.round((completedEnrollments / enrollments) * 100)
      : 0;
    const refundRatePct = paidOrders + refundedOrders
      ? Math.round((refundedOrders / (paidOrders + refundedOrders)) * 100)
      : 0;

    return {
      revenueCents: revenue._sum.totalCents ?? 0,
      enrollments,
      students,
      instructors,
      publishedCourses,
      completionRatePct,
      refundRatePct,
      paidOrders,
    };
  }

  async analytics(): Promise<AdminAnalyticsDto> {
    const since14 = new Date();
    since14.setHours(0, 0, 0, 0);
    since14.setDate(since14.getDate() - 13);

    const [
      recentOrders,
      recentEnrollments,
      paidOrdersByRegion,
      totalStudents,
      enrolledCourses,
      completedCourses,
      purchasedCourses,
      latestOrders,
      latestEnrollments,
      latestReviews,
      latestSignups,
    ] = await this.repo.analyticsBatch(since14);

    const revenueTrend = this.buildRevenueTrend(since14, recentOrders, recentEnrollments);
    const revenueByRegion = this.buildRevenueByRegion(paidOrdersByRegion);
    const funnel = this.buildFunnel(
      totalStudents,
      enrolledCourses,
      purchasedCourses,
      completedCourses,
    );
    const recentActivity = this.buildRecentActivity(
      latestOrders,
      latestEnrollments,
      latestReviews,
      latestSignups,
    );

    return { revenueTrend, revenueByRegion, funnel, recentActivity };
  }

  // ── revenue/enrollments per day, last 14 days ──
  private buildRevenueTrend(
    since14: Date,
    recentOrders: Awaited<ReturnType<AdminRepository["analyticsBatch"]>>[0],
    recentEnrollments: Awaited<ReturnType<AdminRepository["analyticsBatch"]>>[1],
  ) {
    const byDate = new Map<string, { revenueCents: number; enrollments: number }>();
    for (let i = 0; i < 14; i++) {
      const d = new Date(since14);
      d.setDate(since14.getDate() + i);
      byDate.set(d.toISOString().slice(0, 10), { revenueCents: 0, enrollments: 0 });
    }
    for (const o of recentOrders) {
      const key = (o.paidAt ?? new Date()).toISOString().slice(0, 10);
      const row = byDate.get(key);
      if (row) row.revenueCents += o.totalCents;
    }
    for (const e of recentEnrollments) {
      const key = e.enrolledAt.toISOString().slice(0, 10);
      const row = byDate.get(key);
      if (row) row.enrollments += 1;
    }
    return [...byDate.entries()].map(([date, v]) => ({ date, ...v }));
  }

  // ── all regions by paid revenue ──
  private buildRevenueByRegion(
    paidOrders: Awaited<ReturnType<AdminRepository["analyticsBatch"]>>[2],
  ) {
    const totals = new Map<string, number>();
    for (const order of paidOrders) {
      // New orders use the checkout region. Fall back to the buyer profile for
      // historical orders created before region attribution was persisted.
      const country = order.country?.trim() || order.user.country?.trim() || "Unknown";
      totals.set(country, (totals.get(country) ?? 0) + order.totalCents);
    }

    return [...totals]
      .map(([country, revenueCents]) => ({ country, revenueCents }))
      .sort((a, b) => b.revenueCents - a.revenueCents)
  }

  private buildFunnel(
    totalStudents: number,
    enrolledCourses: number,
    purchasedCourses: number,
    completedCourses: number,
  ) {
    return [
      { stage: "Signed up", count: totalStudents },
      { stage: "Enrolled courses", count: enrolledCourses },
      { stage: "Purchased courses", count: purchasedCourses },
      { stage: "Completed courses", count: completedCourses },
    ];
  }

  private buildRecentActivity(
    latestOrders: Awaited<ReturnType<AdminRepository["analyticsBatch"]>>[7],
    latestEnrollments: Awaited<ReturnType<AdminRepository["analyticsBatch"]>>[8],
    latestReviews: Awaited<ReturnType<AdminRepository["analyticsBatch"]>>[9],
    latestSignups: Awaited<ReturnType<AdminRepository["analyticsBatch"]>>[10],
  ): AdminAnalyticsDto["recentActivity"] {
    return [
      ...latestOrders.map((o) => ({
        type: "order" as const,
        label: `${o.user.name} paid $${(o.totalCents / 100).toFixed(2)}`,
        at: (o.paidAt ?? new Date()).toISOString(),
      })),
      ...latestEnrollments.map((e) => ({
        type: "enrollment" as const,
        label: `${e.user.name} enrolled in ${e.course.title}`,
        at: e.enrolledAt.toISOString(),
      })),
      ...latestReviews.map((r) => ({
        type: "review" as const,
        label: `${r.user.name} rated ${r.course.title} ${r.rating}★`,
        at: r.createdAt.toISOString(),
      })),
      ...latestSignups.map((u) => ({
        type: "signup" as const,
        label: `${u.name} signed up`,
        at: u.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 8);
  }

  async students(query: SearchQuery): Promise<Paginated<AdminStudentDto>> {
    const where: Prisma.UserWhereInput = {
      role: "STUDENT",
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { email: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.repo.findStudentsPage(
      where,
      query.page,
      query.pageSize,
    );
    return {
      items: rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        country: u.country,
        status: u.studentProfile?.status ?? "ACTIVE",
        totalSpentCents: u.studentProfile?.totalSpentCents ?? 0,
        enrollments: u._count.enrollments,
        joinedAt: u.createdAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async studentProfile(userId: string): Promise<AdminStudentProfileDto> {
    const user = await this.repo.findStudentProfile(userId);
    if (!user) throw new NotFoundException("Student not found");

    const profile = user.studentProfile;
    const courses = user.enrollments.map((enrollment) => {
      const lessonCount = enrollment.course.sections.reduce(
        (count, section) => count + section.lessons.length,
        0,
      );
      const completedCount = enrollment.lessonProgress.length;
      return {
        id: enrollment.course.id,
        title: enrollment.course.title,
        status: enrollment.status,
        completedLessons: completedCount,
        totalLessons: lessonCount,
        progressPct: lessonCount ? Math.round((completedCount / lessonCount) * 100) : 0,
        enrolledAt: enrollment.enrolledAt.toISOString(),
        lastActivityAt: enrollment.lastActivityAt.toISOString(),
        completedAt: enrollment.completedAt?.toISOString() ?? null,
        certificateIssuedAt: enrollment.certificate?.issuedAt.toISOString() ?? null,
      };
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      country: user.country,
      phone: user.phone,
      status: profile?.status ?? "ACTIVE",
      streakDays: profile?.streakDays ?? 0,
      totalSpentCents: profile?.totalSpentCents ?? 0,
      joinedAt: user.createdAt.toISOString(),
      lastActivityAt: courses[0]?.lastActivityAt ?? null,
      enrollments: courses.length,
      completedCourses: courses.filter((course) => course.status === "COMPLETED").length,
      certificates: courses.filter((course) => course.certificateIssuedAt).length,
      interests: {
        categories: profile?.interestCategories ?? [],
        keywords: profile?.interestKeywords ?? [],
      },
      courses,
    };
  }

  /** Global counts, independent of the students search/pagination above. */
  async studentStats(): Promise<AdminStudentStatsDto> {
    const [total, active] = await this.repo.studentStatsCounts();
    return { total, active, atRisk: total - active };
  }

  /** `visibility`/`category`/`unassignedToOrgId` back the org-assignment
   *  dialog's "Add courses" picker (list published courses — public or
   *  private — not yet assigned to a given org); the admin table itself
   *  only ever passes `status`/`q`. */
  async courses(query: AdminCourseQuery) {
    const q = query.q?.trim();
    const where: Prisma.CourseWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.visibility ? { visibility: query.visibility } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.unassignedToOrgId
        ? { orgAssignments: { none: { orgId: query.unassignedToOrgId } } }
        : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
              { instructor: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.repo.findCoursesPage(
      where,
      query.page,
      query.pageSize,
    );
    // Admin view also exposes revenue and org-assignment count (neither part
    // of the public summary).
    return {
      items: rows.map((r) => ({
        ...toCourseSummary(r),
        revenueCents: r.revenueCents,
        orgAssignmentCount: r._count.orgAssignments,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async courseStats(): Promise<AdminCourseStatsDto> {
    const [total, published] = await this.repo.courseStatsCounts();
    return { total, published };
  }

  async orders(query: SearchQuery): Promise<Paginated<OrderDto>> {
    const q = query.q?.trim();
    const where: Prisma.OrderWhereInput = q
      ? {
          OR: [
            { id: { contains: q, mode: "insensitive" } },
            { couponCode: { contains: q, mode: "insensitive" } },
            { providerPaymentId: { contains: q, mode: "insensitive" } },
            { providerRef: { contains: q, mode: "insensitive" } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { user: { name: { contains: q, mode: "insensitive" } } },
            {
              items: {
                some: {
                  titleSnapshot: { contains: q, mode: "insensitive" },
                },
              },
            },
          ],
        }
      : {};
    const [rows, total] = await this.repo.findOrdersPage(
      where,
      query.page,
      query.pageSize,
    );
    return {
      items: rows.map((row) => this.toOrderDto(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async orderStats(): Promise<AdminOrderStatsDto> {
    const [total, paidAgg, refundCount] = await this.repo.orderStatsCounts();
    return {
      total,
      grossPaidCents: paidAgg._sum.totalCents ?? 0,
      refundCount,
    };
  }

  // ── coupons ──────────────────────────────────────────────────────────────
  private toCouponDto(c: Coupon): CouponDto {
    return {
      code: c.code,
      type: c.type,
      value: c.value,
      description: c.description,
      minSpendCents: c.minSpendCents,
      scope: c.scope,
      courseId: c.courseId,
      expiresAt: c.expiresAt.toISOString(),
      usageLimit: c.usageLimit,
      used: c.used,
      active: c.active,
      featured: c.featured,
    };
  }

  async listCoupons(query: SearchQuery): Promise<Paginated<CouponDto>> {
    const q = query.q?.trim();
    const where: Prisma.CouponWhereInput = q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};
    const [rows, total] = await this.repo.findCouponsPage(
      where,
      query.page,
      query.pageSize,
    );
    return {
      items: rows.map((c) => this.toCouponDto(c)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async upsertCoupon(input: UpsertCouponInput): Promise<CouponDto> {
    const data = {
      type: input.type,
      value: input.value,
      description: input.description,
      minSpendCents: input.minSpendCents ?? null,
      scope: input.scope,
      courseId: input.courseId ?? null,
      expiresAt: new Date(input.expiresAt),
      usageLimit: input.usageLimit,
      active: input.active,
    };
    const c = await this.repo.upsertCoupon(input.code, { code: input.code, ...data }, data);
    return this.toCouponDto(c);
  }

  /** Enable/disable and promote/unpromote. Promoting demotes the incumbent in the
   *  same transaction, so the "only one featured" index is never violated. */
  async patchCoupon(code: string, input: PatchCouponInput): Promise<CouponDto> {
    const c = await this.repo.runTransaction(async (tx) => {
      if (!(await this.repo.findCouponByCode(code, tx)))
        throw new NotFoundException("Coupon not found");
      if (input.featured === true)
        await this.repo.demoteOtherFeaturedCoupons(code, tx);
      return this.repo.updateCoupon(code, input, tx);
    });
    return this.toCouponDto(c);
  }

  async deleteCoupon(code: string): Promise<{ ok: true }> {
    await this.repo.deleteCoupon(code);
    return { ok: true };
  }

  // ── platform settings ──────────────────────────────────────────────────────
  private toSettingsDto(s: PlatformSettings): PlatformSettingsDto {
    return {
      platformName: s.platformName,
      supportEmail: s.supportEmail,
      baseCurrency: s.baseCurrency,
      defaultLanguage: s.defaultLanguage,
      stripeEnabled: s.stripeEnabled,
      paypalEnabled: s.paypalEnabled,
      sslcommerzEnabled: s.sslcommerzEnabled,
      notifications: (s.notifications ?? {}) as Record<string, boolean>,
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  /** The one settings row, created with schema defaults on first read. */
  async settings(): Promise<PlatformSettingsDto> {
    const s = await this.repo.upsertSettings(SETTINGS_ID, {}, { id: SETTINGS_ID });
    return this.toSettingsDto(s);
  }

  async updateSettings(
    input: UpdatePlatformSettingsInput,
  ): Promise<PlatformSettingsDto> {
    const s = await this.repo.upsertSettings(SETTINGS_ID, input, { id: SETTINGS_ID, ...input });
    return this.toSettingsDto(s);
  }

  // ── user management ────────────────────────────────────────────────────────
  async updateUserStatus(userId: string, input: UpdateUserStatusInput) {
    const user = await this.repo.findUser(userId);
    if (!user) throw new NotFoundException("User not found");
    await this.repo.updateStudentProfileStatus(userId, { status: input.status });
    return { ok: true as const };
  }

  /**
   * Hard-deletes an account. Refused once the user has financial history:
   * orders are the platform's own accounting record and their `userId` is not
   * nullable, so deleting the user would either destroy or orphan them. Those
   * accounts get suspended instead.
   */
  async deleteUser(userId: string) {
    const user = await this.repo.findUser(userId);
    if (!user) throw new NotFoundException("User not found");
    const orders = await this.repo.countOrdersByUser(userId);
    if (orders > 0)
      throw new BadRequestException(
        `Cannot delete an account with ${orders} order(s) — suspend it instead`,
      );
    // An instructor's courses carry enrollments and order history of their own.
    const authored = await this.repo.countCoursesByInstructor(userId);
    if (authored > 0)
      throw new BadRequestException(
        `Cannot delete an instructor who still owns ${authored} course(s) — reassign or delete them first`,
      );
    // Reviews and comments are the user's own content and carry no accounting
    // value, so they go with the account.
    await this.repo.deleteUserCascade(userId);
    return { ok: true as const };
  }

  // ── order refunds ──────────────────────────────────────────────────────────
  /**
   * Credit-only refund. One admin action can refund any subset of the order's
   * items with arbitrary per-item amounts (each ≤ that item's remaining
   * refundable). No payment-gateway call is ever made — the student is made
   * whole via store credit only.
   *
   * Access is revoked only for items that become fully refunded in this action
   * (cumulative `refundedCents == priceCents`). A dollar-partial refund on an
   * otherwise-active item leaves the student's enrollment intact.
   */
  async refundOrder(
    orderId: string,
    input: RefundOrderInput,
    adminUserId: string,
  ): Promise<OrderDto> {
    const order = await this.loadRefundableOrder(orderId);
    const plan = this.buildRefundPlan(order, input);

    await this.applyRefundToLedger(order, plan, input.comment, adminUserId);

    await this.notifications.notifyEmailAfterCommit(
      this.refundNotifyInput(order, plan, input.comment),
    );

    const updated = await this.repo.findOrderWithItemsOrThrow(orderId);
    return this.toOrderDto(updated);
  }

  private async loadRefundableOrder(orderId: string) {
    const order = await this.repo.findOrderWithItems(orderId);
    if (!order) throw new NotFoundException("Order not found");
    if (order.status === "REFUNDED")
      throw new BadRequestException("Order already fully refunded");
    return order;
  }

  /** Cross-checks the admin's requested items/amounts against the order's live
   *  state and returns a normalized per-item plan. Also flags which items will
   *  become fully refunded (→ revoke access + decrement student counts). */
  private buildRefundPlan(
    order: NonNullable<Awaited<ReturnType<AdminRepository["findOrderWithItems"]>>>,
    input: RefundOrderInput,
  ): RefundPlan {
    const itemsById = new Map(order.items.map((i) => [i.id, i]));
    const seen = new Set<string>();
    const entries: RefundPlan["entries"] = [];

    for (const req of input.items) {
      if (seen.has(req.orderItemId))
        throw new BadRequestException(
          `Item ${req.orderItemId} appears more than once in the refund request`,
        );
      seen.add(req.orderItemId);

      const item = itemsById.get(req.orderItemId);
      if (!item)
        throw new BadRequestException(
          `Item ${req.orderItemId} does not belong to this order`,
        );

      const remaining = item.priceCents - item.refundedCents;
      if (remaining <= 0)
        throw new BadRequestException(
          `Item "${item.titleSnapshot}" is already fully refunded`,
        );
      if (req.amountCents > remaining)
        throw new BadRequestException(
          `Refund amount for "${item.titleSnapshot}" exceeds the remaining ${remaining} cents`,
        );

      const newRefunded = item.refundedCents + req.amountCents;
      entries.push({
        itemId: item.id,
        courseId: item.courseId,
        titleSnapshot: item.titleSnapshot,
        priceCents: item.priceCents,
        amountCents: req.amountCents,
        fullyRefundedAfter: newRefunded === item.priceCents,
      });
    }

    const total = entries.reduce((sum, e) => sum + e.amountCents, 0);
    // Cap refund at the portion of the order that was actually money-paid.
    // The credit-applied portion is not returnable as fresh credit (it would
    // compound the balance without a corresponding money movement).
    const refundableTotal = order.totalCents - order.creditAppliedCents;
    const alreadyRefunded = order.refundedCents;
    if (alreadyRefunded + total > refundableTotal)
      throw new BadRequestException(
        `Refund total exceeds the order's remaining refundable amount`,
      );

    const newOrderRefunded = alreadyRefunded + total;
    return {
      entries,
      total,
      newOrderRefunded,
      status: newOrderRefunded >= refundableTotal ? "REFUNDED" : "PARTIALLY_REFUNDED",
    };
  }

  private refundNotifyInput(
    order: NonNullable<Awaited<ReturnType<AdminRepository["findOrderWithItems"]>>>,
    plan: RefundPlan,
    comment: string,
  ) {
    const lines = plan.entries
      .map(
        (e) =>
          `${e.titleSnapshot} (${order.currency} ${(e.amountCents / 100).toFixed(2)})`,
      )
      .join(", ");
    const amount = `${order.currency} ${(plan.total / 100).toFixed(2)}`;
    const isFullOrder = plan.status === "REFUNDED";
    return {
      userId: order.userId,
      event: "ORDER_REFUNDED" as const,
      title: isFullOrder ? "Order refunded" : "Partial refund issued",
      body: `${amount} store credit added for: ${lines}. Reason: ${comment}.`,
      href: "/dashboard/credits",
    };
  }

  private async applyRefundToLedger(
    order: NonNullable<Awaited<ReturnType<AdminRepository["findOrderWithItems"]>>>,
    plan: RefundPlan,
    comment: string,
    adminUserId: string,
  ): Promise<void> {
    await this.repo.runTransaction(async (tx) => {
      const fullyRefundedCourseIds: string[] = [];

      for (const entry of plan.entries) {
        await this.repo.incrementOrderItemRefunded(entry.itemId, entry.amountCents, tx);
        const course = await this.repo.decrementCourseOnRefund(
          entry.courseId,
          entry.amountCents,
          entry.fullyRefundedAfter,
          tx,
        );
        await this.repo.decrementInstructorOnRefund(
          course.instructorId,
          entry.amountCents,
          entry.fullyRefundedAfter,
          tx,
        );
        if (entry.fullyRefundedAfter) fullyRefundedCourseIds.push(entry.courseId);
      }

      await this.repo.updateOrderRefundState(
        order.id,
        { status: plan.status, refundedCents: plan.newOrderRefunded },
        tx,
      );
      await this.repo.decrementStudentTotalSpent(order.userId, plan.total, tx);
      await this.repo.deleteEnrollmentsForRefund(order.userId, fullyRefundedCourseIds, tx);

      // Ledger row + in-app notification inside the same tx so the credit,
      // notification, and status transition either all commit or all roll back.
      await this.credits.grantRefund(
        {
          userId: order.userId,
          amountCents: plan.total,
          currency: order.currency,
          orderId: order.id,
          adminUserId,
          comment,
        },
        tx,
      );
      await this.notifications.notify(
        this.refundNotifyInput(order, plan, comment),
        tx,
      );
    });
  }

  private toOrderDto(
    updated: Awaited<ReturnType<AdminRepository["findOrderWithItemsOrThrow"]>>,
  ): OrderDto {
    return {
      id: updated.id,
      status: updated.status,
      gateway: updated.gateway,
      subtotalCents: updated.subtotalCents,
      discountCents: updated.discountCents,
      creditAppliedCents: updated.creditAppliedCents,
      totalCents: updated.totalCents,
      currency: updated.currency,
      couponCode: updated.couponCode,
      items: updated.items.map((i) => ({
        id: i.id,
        courseId: i.courseId,
        title: i.titleSnapshot,
        priceCents: i.priceCents,
        refundedCents: i.refundedCents,
      })),
      refundedCents: updated.refundedCents,
      createdAt: updated.createdAt.toISOString(),
      paidAt: updated.paidAt?.toISOString() ?? null,
    };
  }

  // ── marketing / automation ─────────────────────────────────────────────────
  private toAutomationRuleDto(r: AutomationRule): AutomationRuleDto {
    return {
      id: r.id,
      name: r.name,
      trigger: r.trigger,
      condition: r.condition,
      channels: r.channels,
      template: r.template,
      active: r.active,
      sentCount: r.sentCount,
    };
  }

  async listAutomationRules(): Promise<AutomationRuleDto[]> {
    const rows = await this.repo.findAllAutomationRules();
    return rows.map((r) => this.toAutomationRuleDto(r));
  }

  async upsertAutomationRule(
    id: string | undefined,
    input: UpsertAutomationRuleInput,
  ): Promise<AutomationRuleDto> {
    if (id) {
      const existing = await this.repo.findAutomationRule(id);
      if (!existing) throw new NotFoundException("Automation rule not found");
      return this.toAutomationRuleDto(
        await this.repo.updateAutomationRule(id, input),
      );
    }
    return this.toAutomationRuleDto(
      await this.repo.createAutomationRule(input),
    );
  }

  async deleteAutomationRule(id: string) {
    const existing = await this.repo.findAutomationRule(id);
    if (!existing) throw new NotFoundException("Automation rule not found");
    await this.repo.deleteAutomationRule(id);
    return { ok: true as const };
  }

  /** Recent sends, newest first. Joined with the recipient's name so the admin
   *  table doesn't need a second lookup per row. */
  async listReminderLogs(): Promise<ReminderLogDto[]> {
    const rows = await this.repo.findReminderLogs();
    return rows.map((l) => ({
      id: l.id,
      userId: l.userId,
      userName: l.user?.name ?? null,
      ruleId: l.ruleId,
      channel: l.channel,
      trigger: l.trigger,
      subject: l.subject,
      status: l.status,
      createdAt: l.createdAt.toISOString(),
    }));
  }
}
