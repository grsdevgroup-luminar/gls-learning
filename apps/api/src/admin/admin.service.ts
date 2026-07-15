import { Injectable, NotFoundException } from "@nestjs/common";
import { Coupon } from "@prisma/client";
import type {
  AdminOverviewDto,
  AdminStudentDto,
  CouponDto,
  OrderDto,
  UpsertAutomationRuleInput,
  UpsertCouponInput,
  UpdateUserStatusInput,
} from "@skillstream/shared";
import { PrismaService } from "../prisma/prisma.service";
import {
  COURSE_SUMMARY_INCLUDE,
  toCourseSummary,
} from "../courses/course.mapper";

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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

  async deleteCoupon(code: string): Promise<{ ok: true }> {
    await this.prisma.coupon.delete({ where: { code } });
    return { ok: true };
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
  listAutomationRules() {
    return this.prisma.automationRule.findMany({ orderBy: { createdAt: "asc" } });
  }

  async upsertAutomationRule(id: string | undefined, input: UpsertAutomationRuleInput) {
    if (id) {
      const existing = await this.prisma.automationRule.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException("Automation rule not found");
      return this.prisma.automationRule.update({ where: { id }, data: input });
    }
    return this.prisma.automationRule.create({ data: input });
  }

  async deleteAutomationRule(id: string) {
    const existing = await this.prisma.automationRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Automation rule not found");
    await this.prisma.automationRule.delete({ where: { id } });
    return { ok: true as const };
  }

  listReminderLogs() {
    return this.prisma.reminderLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
}
