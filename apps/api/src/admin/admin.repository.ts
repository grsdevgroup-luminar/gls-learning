import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { COURSE_SUMMARY_INCLUDE } from "../courses/course.mapper";

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db) {
    return tx ?? this.prisma;
  }

  // ── overview ──────────────────────────────────────────────────────────────
  overviewCounts() {
    return this.prisma.$transaction([
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
  }

  // ── analytics ─────────────────────────────────────────────────────────────
  analyticsBatch(since14: Date) {
    return this.prisma.$transaction([
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
  }

  // ── students ──────────────────────────────────────────────────────────────
  findStudentsPage(where: Prisma.UserWhereInput, page: number, pageSize: number) {
    return this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: {
          studentProfile: true,
          _count: { select: { enrollments: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
  }

  studentStatsCounts() {
    return this.prisma.$transaction([
      this.prisma.user.count({ where: { role: "STUDENT" } }),
      this.prisma.user.count({
        where: { role: "STUDENT", studentProfile: { status: "ACTIVE" } },
      }),
    ]);
  }

  // ── courses ───────────────────────────────────────────────────────────────
  findAllCourses() {
    return this.prisma.course.findMany({
      include: COURSE_SUMMARY_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });
  }

  // ── orders ────────────────────────────────────────────────────────────────
  findAllOrders() {
    return this.prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  }

  findOrderWithItems(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
  }

  findOrderWithItemsOrThrow(orderId: string) {
    return this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });
  }

  // ── coupons ───────────────────────────────────────────────────────────────
  findAllCoupons() {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  findCouponByCode(code: string, tx?: Db) {
    return this.db(tx).coupon.findUnique({ where: { code } });
  }

  upsertCoupon(
    code: string,
    create: Prisma.CouponCreateInput,
    update: Prisma.CouponUpdateInput,
  ) {
    return this.prisma.coupon.upsert({
      where: { code },
      update,
      create,
    });
  }

  demoteOtherFeaturedCoupons(code: string, tx?: Db) {
    return this.db(tx).coupon.updateMany({
      where: { featured: true, code: { not: code } },
      data: { featured: false },
    });
  }

  updateCoupon(code: string, data: Prisma.CouponUpdateInput, tx?: Db) {
    return this.db(tx).coupon.update({ where: { code }, data });
  }

  deleteCoupon(code: string) {
    return this.prisma.coupon.delete({ where: { code } });
  }

  // ── platform settings ─────────────────────────────────────────────────────
  upsertSettings(
    id: string,
    update: Prisma.PlatformSettingsUpdateInput,
    create: Prisma.PlatformSettingsCreateInput,
  ) {
    return this.prisma.platformSettings.upsert({
      where: { id },
      update,
      create,
    });
  }

  // ── user management ───────────────────────────────────────────────────────
  findUser(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  updateStudentProfileStatus(
    userId: string,
    data: Prisma.StudentProfileUpdateManyMutationInput,
  ) {
    return this.prisma.studentProfile.updateMany({
      where: { userId },
      data,
    });
  }

  countOrdersByUser(userId: string) {
    return this.prisma.order.count({ where: { userId } });
  }

  countCoursesByInstructor(instructorId: string) {
    return this.prisma.course.count({ where: { instructorId } });
  }

  deleteUserCascade(userId: string) {
    return this.prisma.$transaction([
      this.prisma.review.deleteMany({ where: { userId } }),
      this.prisma.comment.deleteMany({ where: { userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
  }

  // ── refunds ───────────────────────────────────────────────────────────────
  updateOrderStatusRefunded(orderId: string, tx?: Db) {
    return this.db(tx).order.update({
      where: { id: orderId },
      data: { status: "REFUNDED" },
    });
  }

  decrementCourseRevenueAndStudents(
    courseId: string,
    priceCents: number,
    tx?: Db,
  ) {
    return this.db(tx).course.update({
      where: { id: courseId },
      data: {
        revenueCents: { decrement: priceCents },
        studentCount: { decrement: 1 },
      },
      select: { instructorId: true },
    });
  }

  decrementInstructorEarningsAndStudents(
    instructorUserId: string,
    priceCents: number,
    tx?: Db,
  ) {
    return this.db(tx).instructorProfile.updateMany({
      where: { userId: instructorUserId },
      data: {
        earningsCents: { decrement: priceCents },
        studentCount: { decrement: 1 },
      },
    });
  }

  decrementStudentTotalSpent(userId: string, totalCents: number, tx?: Db) {
    return this.db(tx).studentProfile.updateMany({
      where: { userId },
      data: { totalSpentCents: { decrement: totalCents } },
    });
  }

  deleteEnrollmentsForRefund(userId: string, courseIds: string[], tx?: Db) {
    return this.db(tx).enrollment.deleteMany({
      where: {
        userId,
        courseId: { in: courseIds },
      },
    });
  }

  runTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(fn);
  }

  // ── automation rules ──────────────────────────────────────────────────────
  findAllAutomationRules() {
    return this.prisma.automationRule.findMany({
      orderBy: { createdAt: "asc" },
    });
  }

  findAutomationRule(id: string) {
    return this.prisma.automationRule.findUnique({ where: { id } });
  }

  updateAutomationRule(id: string, data: Prisma.AutomationRuleUpdateInput) {
    return this.prisma.automationRule.update({ where: { id }, data });
  }

  createAutomationRule(data: Prisma.AutomationRuleCreateInput) {
    return this.prisma.automationRule.create({ data });
  }

  deleteAutomationRule(id: string) {
    return this.prisma.automationRule.delete({ where: { id } });
  }

  // ── reminder logs ─────────────────────────────────────────────────────────
  findReminderLogs() {
    return this.prisma.reminderLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { name: true } } },
    });
  }
}
