import { Injectable } from "@nestjs/common";
import { Coupon } from "@prisma/client";
import type {
  AdminOverviewDto,
  AdminStudentDto,
  CouponDto,
  OrderDto,
  UpsertCouponInput,
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
    return rows.map(toCourseSummary);
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

  // ── marketing ──────────────────────────────────────────────────────────
  listAutomationRules() {
    return this.prisma.automationRule.findMany({ orderBy: { createdAt: "asc" } });
  }

  listReminderLogs() {
    return this.prisma.reminderLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
}
