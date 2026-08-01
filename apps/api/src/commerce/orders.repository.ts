import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export const orderInclude = { items: true } satisfies Prisma.OrderInclude;
export type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db) {
    return tx ?? this.prisma;
  }

  findPublishedCoursesByIds(ids: string[]) {
    return this.prisma.course.findMany({
      where: { id: { in: ids }, status: "PUBLISHED" },
      select: { id: true, title: true, basePriceCents: true },
    });
  }

  findPlatformSettings() {
    return this.prisma.platformSettings.findUnique({
      where: { id: "singleton" },
    });
  }

  findOwnedEnrollments(userId: string, courseIds: string[]) {
    return this.prisma.enrollment.findMany({
      where: { userId, courseId: { in: courseIds } },
      select: { courseId: true },
    });
  }

  createOrder(
    data: Prisma.OrderCreateInput | Prisma.OrderUncheckedCreateInput,
    tx?: Db,
  ) {
    return this.db(tx).order.create({
      include: orderInclude,
      data,
    });
  }

  findById(orderId: string, tx?: Db) {
    return this.db(tx).order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
  }

  findByIdAndUserWithUser(orderId: string, userId: string) {
    return this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { ...orderInclude, user: { select: { name: true, email: true } } },
    });
  }

  findByIdWithUser(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { ...orderInclude, user: { select: { name: true, email: true } } },
    });
  }

  findManyByUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  updateOrder(orderId: string, data: Prisma.OrderUpdateInput, tx?: Db) {
    return this.db(tx).order.update({
      where: { id: orderId },
      data,
    });
  }

  incrementCourseRevenue(courseId: string, priceCents: number, tx?: Db) {
    return this.db(tx).course.update({
      where: { id: courseId },
      data: { revenueCents: { increment: priceCents } },
      select: { instructorId: true },
    });
  }

  incrementInstructorEarnings(instructorUserId: string, priceCents: number, tx?: Db) {
    return this.db(tx).instructorProfile.updateMany({
      where: { userId: instructorUserId },
      data: { earningsCents: { increment: priceCents } },
    });
  }

  incrementStudentTotalSpent(userId: string, totalCents: number, tx?: Db) {
    return this.db(tx).studentProfile.updateMany({
      where: { userId },
      data: { totalSpentCents: { increment: totalCents } },
    });
  }

  incrementCouponUsed(couponCode: string, tx?: Db) {
    return this.db(tx).coupon.update({
      where: { code: couponCode },
      data: { used: { increment: 1 } },
    });
  }

  createCouponRedemption(
    data: Prisma.CouponRedemptionUncheckedCreateInput,
    tx?: Db,
  ) {
    return this.db(tx).couponRedemption.create({ data });
  }
}
