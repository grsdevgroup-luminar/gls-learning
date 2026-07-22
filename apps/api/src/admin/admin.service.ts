import { Injectable, NotFoundException } from "@nestjs/common";
import { AutomationRule, Coupon, PlatformSettings } from "@prisma/client";
import type {
  AdminAnalyticsDto,
  AdminOverviewDto,
  AdminStudentDto,
  AutomationRuleDto,
  CouponDto,
  PlatformSettingsDto,
  UpdatePlatformSettingsInput,
  ReminderLogDto,
  OrderDto,
  PatchCouponInput,
  UpsertAutomationRuleInput,
  UpsertCouponInput,
  UpdateUserStatusInput,
} from "@skillstream/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import {
  COURSE_SUMMARY_INCLUDE,
  toCourseSummary,
} from "../courses/course.mapper";

/** Settings are a single pinned row (see the PlatformSettings model). */
const SETTINGS_ID = "singleton";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
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
    ] = await this.prisma.$transaction([
      this.prisma.order.aggregate({
        where: { status: "PAID" },
        _sum: { totalCents: true },
      }),
      this.prisma.enrollment.count(),
      this.prisma.enrollment.count({ where: { status: "COMPLETED" } }),
      this.prisma.user.count({ where: { role: "STUDENT" } }),
      this.prisma.user.count({ where: { role: "INSTRUCTOR" } }),
      this.prisma.course.count({ where: { status: "PUBLISHED" } }),
      this.prisma.order.count({ where: { status: "PAID" } }),
      this.prisma.order.count({ where: { status: "REFUNDED" } }),
    ]);

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
    ] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: { status: "PAID", paidAt: { gte: since14 } },
        select: { totalCents: true, paidAt: true },
      }),
      this.prisma.enrollment.findMany({
        where: { enrolledAt: { gte: since14 } },
        select: { enrolledAt: true },
      }),
      this.prisma.order.groupBy({
        by: ["country"],
        where: { status: "PAID" },
        _sum: { totalCents: true },
        orderBy: { _sum: { totalCents: "desc" } },
      }),
      this.prisma.user.count({ where: { role: "STUDENT" } }),
      this.prisma.enrollment.findMany({
        distinct: ["userId"],
        select: { userId: true },
      }),
      this.prisma.enrollment.findMany({
        where: { status: "COMPLETED" },
        distinct: ["userId"],
        select: { userId: true },
      }),
      this.prisma.order.findMany({
        where: { status: "PAID" },
        distinct: ["userId"],
        select: { userId: true },
      }),
      this.prisma.order.findMany({
        where: { status: "PAID" },
        orderBy: { paidAt: "desc" },
        take: 5,
        select: { id: true, totalCents: true, paidAt: true, user: { select: { name: true } } },
      }),
      this.prisma.enrollment.findMany({
        orderBy: { enrolledAt: "desc" },
        take: 5,
        select: { enrolledAt: true, user: { select: { name: true } }, course: { select: { title: true } } },
      }),
      this.prisma.review.findMany({
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { createdAt: true, rating: true, user: { select: { name: true } }, course: { select: { title: true } } },
      }),
      this.prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { createdAt: true, name: true },
      }),
    ]);

    // ── revenue/enrollments per day, last 14 days ──
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
    const revenueTrend = [...byDate.entries()].map(([date, v]) => ({ date, ...v }));

    // ── top regions by revenue ──
    const revenueByRegion = revenueByCountry
      .map((r) => ({ country: r.country ?? "Unknown", revenueCents: r._sum?.totalCents ?? 0 }))
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, 6);

    const funnel = [
      { stage: "Signed up", count: totalStudents },
      { stage: "Enrolled", count: enrolledStudentIds.length },
      { stage: "Purchased", count: paidStudentIds.length },
      { stage: "Completed a course", count: completedStudentIds.length },
    ];

    const recentActivity: AdminAnalyticsDto["recentActivity"] = [
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

    return { revenueTrend, revenueByRegion, funnel, recentActivity };
  }

  async students(): Promise<AdminStudentDto[]> {
    const rows = await this.prisma.user.findMany({
      where: { role: "STUDENT" },
      include: {
        studentProfile: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      country: u.country,
      status: u.studentProfile?.status ?? "ACTIVE",
      totalSpentCents: u.studentProfile?.totalSpentCents ?? 0,
      enrollments: u._count.enrollments,
      joinedAt: u.createdAt.toISOString(),
    }));
  }

  async courses() {
    const rows = await this.prisma.course.findMany({
      include: COURSE_SUMMARY_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });
    // Admin view also exposes revenue (not part of the public summary).
    return rows.map((r) => ({ ...toCourseSummary(r), revenueCents: r.revenueCents }));
  }

  async orders(): Promise<OrderDto[]> {
    const rows = await this.prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
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
    const rows = await this.prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
    });
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
    const c = await this.prisma.coupon.upsert({
      where: { code: input.code },
      update: data,
      create: { code: input.code, ...data },
    });
    return this.toCouponDto(c);
  }

  /** Enable/disable and promote/unpromote. Promoting demotes the incumbent in the
   *  same transaction, so the "only one featured" index is never violated. */
  async patchCoupon(code: string, input: PatchCouponInput): Promise<CouponDto> {
    const c = await this.prisma.$transaction(async (tx) => {
      if (!(await tx.coupon.findUnique({ where: { code } })))
        throw new NotFoundException("Coupon not found");
      if (input.featured === true)
        await tx.coupon.updateMany({
          where: { featured: true, code: { not: code } },
          data: { featured: false },
        });
      return tx.coupon.update({ where: { code }, data: input });
    });
    return this.toCouponDto(c);
  }

  async deleteCoupon(code: string): Promise<{ ok: true }> {
    await this.prisma.coupon.delete({ where: { code } });
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
    const s = await this.prisma.platformSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID },
    });
    return this.toSettingsDto(s);
  }

  async updateSettings(
    input: UpdatePlatformSettingsInput,
  ): Promise<PlatformSettingsDto> {
    const s = await this.prisma.platformSettings.upsert({
      where: { id: SETTINGS_ID },
      update: input,
      create: { id: SETTINGS_ID, ...input },
    });
    return this.toSettingsDto(s);
  }

  // ── user management ────────────────────────────────────────────────────────
  async updateUserStatus(userId: string, input: UpdateUserStatusInput) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    await this.prisma.studentProfile.updateMany({
      where: { userId },
      data: { status: input.status },
    });
    return { ok: true as const };
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    await this.prisma.user.delete({ where: { id: userId } });
    return { ok: true as const };
  }

  // ── order refunds ──────────────────────────────────────────────────────────
  async refundOrder(orderId: string): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.status === "REFUNDED") throw new NotFoundException("Order already refunded");

    // Return the money at the gateway before touching our own ledger — if the
    // gateway call fails we want to bail out with the order still PAID rather
    // than mark it refunded without the customer actually getting paid back.
    await this.payments.refundGatewayPayment(order);

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "REFUNDED" },
      });
      for (const item of order.items) {
        const course = await tx.course.update({
          where: { id: item.courseId },
          data: {
            revenueCents: { decrement: item.priceCents },
            studentCount: { decrement: 1 },
          },
          select: { instructorId: true },
        });
        await tx.instructorProfile.updateMany({
          where: { userId: course.instructorId },
          data: {
            earningsCents: { decrement: item.priceCents },
            studentCount: { decrement: 1 },
          },
        });
      }
      await tx.studentProfile.updateMany({
        where: { userId: order.userId },
        data: { totalSpentCents: { decrement: order.totalCents } },
      });
      await tx.enrollment.deleteMany({
        where: {
          userId: order.userId,
          courseId: { in: order.items.map((i) => i.courseId) },
        },
      });
    });

    const updated = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });
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
    const rows = await this.prisma.automationRule.findMany({
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => this.toAutomationRuleDto(r));
  }

  async upsertAutomationRule(
    id: string | undefined,
    input: UpsertAutomationRuleInput,
  ): Promise<AutomationRuleDto> {
    if (id) {
      const existing = await this.prisma.automationRule.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException("Automation rule not found");
      return this.toAutomationRuleDto(
        await this.prisma.automationRule.update({ where: { id }, data: input }),
      );
    }
    return this.toAutomationRuleDto(
      await this.prisma.automationRule.create({ data: input }),
    );
  }

  async deleteAutomationRule(id: string) {
    const existing = await this.prisma.automationRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Automation rule not found");
    await this.prisma.automationRule.delete({ where: { id } });
    return { ok: true as const };
  }

  /** Recent sends, newest first. Joined with the recipient's name so the admin
   *  table doesn't need a second lookup per row. */
  async listReminderLogs(): Promise<ReminderLogDto[]> {
    const rows = await this.prisma.reminderLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { name: true } } },
    });
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
