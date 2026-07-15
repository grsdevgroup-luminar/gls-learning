import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PaymentGateway } from "@prisma/client";
import type { OrderDto } from "@skillstream/shared";
import { PrismaService } from "../prisma/prisma.service";
import { EnrollmentService } from "../enrollment/enrollment.service";
import { SalesAgentService } from "../sales-agent/sales-agent.service";

const orderInclude = { items: true } satisfies Prisma.OrderInclude;
type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export interface CreateOrderInput {
  userId: string;
  country?: string;
  gateway: PaymentGateway;
  couponCode: string | null;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  items: { courseId: string; title: string; priceCents: number }[];
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollment: EnrollmentService,
    private readonly salesAgents: SalesAgentService,
  ) {}

  private toDto(row: OrderRow): OrderDto {
    return {
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
    };
  }

  async createPending(input: CreateOrderInput): Promise<OrderRow> {
    return this.prisma.order.create({
      include: orderInclude,
      data: {
        userId: input.userId,
        country: input.country,
        gateway: input.gateway,
        couponCode: input.couponCode,
        subtotalCents: input.subtotalCents,
        discountCents: input.discountCents,
        totalCents: input.totalCents,
        currency: input.currency,
        status: "PENDING",
        items: {
          create: input.items.map((i) => ({
            courseId: i.courseId,
            titleSnapshot: i.title,
            priceCents: i.priceCents,
          })),
        },
      },
    });
  }

  async findById(orderId: string): Promise<OrderRow | null> {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
  }

  async myOrders(userId: string): Promise<OrderDto[]> {
    const rows = await this.prisma.order.findMany({
      where: { userId },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toDto(r));
  }

  /**
   * Marks an order paid and grants access. Idempotent: re-running on an
   * already-PAID order is a no-op. This is the ONLY path that creates paid
   * enrollments — it is invoked exclusively by verified payment webhooks (or
   * the dev-simulate endpoint).
   */
  async fulfill(orderId: string, providerPaymentId?: string): Promise<OrderDto> {
    const order = await this.findById(orderId);
    if (!order) throw new NotFoundException("Order not found");
    if (order.status === "PAID") return this.toDto(order);

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "PAID",
          paidAt: new Date(),
          providerPaymentId: providerPaymentId ?? order.providerPaymentId,
        },
      });

      await this.enrollment.enrollMany(
        tx,
        order.userId,
        order.items.map((i) => i.courseId),
      );

      for (const item of order.items) {
        const course = await tx.course.update({
          where: { id: item.courseId },
          data: { revenueCents: { increment: item.priceCents } },
          select: { instructorId: true },
        });
        await tx.instructorProfile.updateMany({
          where: { userId: course.instructorId },
          data: { earningsCents: { increment: item.priceCents } },
        });
      }

      await tx.studentProfile.updateMany({
        where: { userId: order.userId },
        data: { totalSpentCents: { increment: order.totalCents } },
      });

      if (order.couponCode) {
        await tx.coupon.update({
          where: { code: order.couponCode },
          data: { used: { increment: 1 } },
        });
        await tx.couponRedemption.create({
          data: {
            couponCode: order.couponCode,
            orderId: order.id,
            userId: order.userId,
          },
        });
      }
    });

    // Credit any attributed sales-agent referral now that payment succeeded.
    await this.salesAgents.confirmReferral(orderId);

    const updated = await this.findById(orderId);
    return this.toDto(updated!);
  }
}
