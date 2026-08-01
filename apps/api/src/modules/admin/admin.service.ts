import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AutomationRule, Coupon, PlatformSettings, Prisma } from "@prisma/client";
import type {
  AdminAnalyticsDto,
  AdminOverviewDto,
  AdminStudentDto,
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
  UpsertAutomationRuleInput,
  UpsertCouponInput,
  UpdateUserStatusInput,
} from "@skillstream/shared";
import { PaymentsService } from "../payments/payments.service";
import { toCourseSummary } from "../courses/course.mapper";
import { AdminRepository } from "./admin.repository";

/** Settings are a single pinned row (see the PlatformSettings model). */
const SETTINGS_ID = "singleton";

@Injectable()
export class AdminService {
  constructor(
    private readonly repo: AdminRepository,
    private readonly payments: PaymentsService,
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
      revenueByCountry,
      totalStudents,
      enrolledStudentIds,
      completedStudentIds,
      paidStudentIds,
      latestOrders,
      latestEnrollments,
      latestReviews,
      latestSignups,
    ] = await this.repo.analyticsBatch(since14);

    const revenueTrend = this.buildRevenueTrend(since14, recentOrders, recentEnrollments);
    const revenueByRegion = this.buildRevenueByRegion(revenueByCountry);
    const funnel = this.buildFunnel(
      totalStudents,
      enrolledStudentIds,
      paidStudentIds,
      completedStudentIds,
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

  // ── top regions by revenue ──
  private buildRevenueByRegion(
    revenueByCountry: Awaited<ReturnType<AdminRepository["analyticsBatch"]>>[2],
  ) {
    return revenueByCountry
      .map((r) => ({ country: r.country ?? "Unknown", revenueCents: r._sum?.totalCents ?? 0 }))
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, 6);
  }

  private buildFunnel(
    totalStudents: number,
    enrolledStudentIds: unknown[],
    paidStudentIds: unknown[],
    completedStudentIds: unknown[],
  ) {
    return [
      { stage: "Signed up", count: totalStudents },
      { stage: "Enrolled", count: enrolledStudentIds.length },
      { stage: "Purchased", count: paidStudentIds.length },
      { stage: "Completed a course", count: completedStudentIds.length },
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

  /** Global counts, independent of the students search/pagination above. */
  async studentStats(): Promise<AdminStudentStatsDto> {
    const [total, active] = await this.repo.studentStatsCounts();
    return { total, active, atRisk: total - active };
  }

  async courses() {
    const rows = await this.repo.findAllCourses();
    // Admin view also exposes revenue (not part of the public summary).
    return rows.map((r) => ({ ...toCourseSummary(r), revenueCents: r.revenueCents }));
  }

  async orders(): Promise<OrderDto[]> {
    const rows = await this.repo.findAllOrders();
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      gateway: row.gateway,
      subtotalCents: row.subtotalCents,
      discountCents: row.discountCents,
      totalCents: row.totalCents,
      currency: row.currency,
      couponCode: row.couponCode,
      items: row.items.map((i) => ({
        courseId: i.courseId,
        title: i.titleSnapshot,
        priceCents: i.priceCents,
      })),
      createdAt: row.createdAt.toISOString(),
      paidAt: row.paidAt?.toISOString() ?? null,
    }));
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

  async listCoupons(): Promise<CouponDto[]> {
    const rows = await this.repo.findAllCoupons();
    return rows.map((c) => this.toCouponDto(c));
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
  async refundOrder(orderId: string): Promise<OrderDto> {
    const order = await this.loadRefundableOrder(orderId);

    // Return the money at the gateway before touching our own ledger — if the
    // gateway call fails we want to bail out with the order still PAID rather
    // than mark it refunded without the customer actually getting paid back.
    await this.payments.refundGatewayPayment(order);

    await this.applyRefundToLedger(order);

    const updated = await this.repo.findOrderWithItemsOrThrow(orderId);
    return this.toRefundedOrderDto(updated);
  }

  private async loadRefundableOrder(orderId: string) {
    const order = await this.repo.findOrderWithItems(orderId);
    if (!order) throw new NotFoundException("Order not found");
    if (order.status === "REFUNDED") throw new NotFoundException("Order already refunded");
    return order;
  }

  private async applyRefundToLedger(
    order: NonNullable<Awaited<ReturnType<AdminRepository["findOrderWithItems"]>>>,
  ): Promise<void> {
    await this.repo.runTransaction(async (tx) => {
      await this.repo.updateOrderStatusRefunded(order.id, tx);
      for (const item of order.items) {
        const course = await this.repo.decrementCourseRevenueAndStudents(
          item.courseId,
          item.priceCents,
          tx,
        );
        await this.repo.decrementInstructorEarningsAndStudents(
          course.instructorId,
          item.priceCents,
          tx,
        );
      }
      await this.repo.decrementStudentTotalSpent(order.userId, order.totalCents, tx);
      await this.repo.deleteEnrollmentsForRefund(
        order.userId,
        order.items.map((i) => i.courseId),
        tx,
      );
    });
  }

  private toRefundedOrderDto(
    updated: Awaited<ReturnType<AdminRepository["findOrderWithItemsOrThrow"]>>,
  ): OrderDto {
    return {
      id: updated.id,
      status: updated.status,
      gateway: updated.gateway,
      subtotalCents: updated.subtotalCents,
      discountCents: updated.discountCents,
      totalCents: updated.totalCents,
      currency: updated.currency,
      couponCode: updated.couponCode,
      items: updated.items.map((i) => ({
        courseId: i.courseId,
        title: i.titleSnapshot,
        priceCents: i.priceCents,
      })),
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
