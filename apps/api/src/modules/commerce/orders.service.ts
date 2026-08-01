import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PaymentGateway } from "@prisma/client";
import type { OrderDto } from "@skillstream/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { receiptPdf } from "../../common/utils/pdf";
import { EmailService } from "../email/email.service";
import { EnrollmentService } from "../enrollment/enrollment.service";
import { SalesAgentService } from "../sales-agent/sales-agent.service";
import { OrdersRepository, type OrderRow } from "./orders.repository";

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
    private readonly repo: OrdersRepository,
    private readonly enrollment: EnrollmentService,
    private readonly salesAgents: SalesAgentService,
    private readonly email: EmailService,
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
    return this.repo.createOrder({
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
    });
  }

  async findById(orderId: string): Promise<OrderRow | null> {
    return this.repo.findById(orderId);
  }

  /**
   * Receipt PDF for one of the caller's own orders. Scoped by `userId` in the
   * query itself — an id from another account is a 404, never a leak — and
   * only settled orders get one (a PENDING order was never charged).
   */
  async receiptPdf(userId: string, orderId: string): Promise<Buffer> {
    const order = await this.repo.findByIdAndUserWithUser(orderId, userId);
    if (!order) throw new NotFoundException("Order not found");
    if (order.status !== "PAID" && order.status !== "REFUNDED")
      throw new BadRequestException("No receipt for an unpaid order");

    return receiptPdf({
      orderId: order.id,
      buyerName: order.user.name,
      buyerEmail: order.user.email,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      status: order.status,
      gateway: order.gateway,
      currency: order.currency,
      couponCode: order.couponCode,
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      totalCents: order.totalCents,
      items: order.items.map((i) => ({
        title: i.titleSnapshot,
        priceCents: i.priceCents,
      })),
    });
  }

  async myOrders(userId: string): Promise<OrderDto[]> {
    const rows = await this.repo.findManyByUser(userId);
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
      await this.repo.updateOrder(
        orderId,
        {
          status: "PAID",
          paidAt: new Date(),
          providerPaymentId: providerPaymentId ?? order.providerPaymentId,
        },
        tx,
      );

      await this.enrollment.enrollMany(
        tx,
        order.userId,
        order.items.map((i) => i.courseId),
      );

      for (const item of order.items) {
        const course = await this.repo.incrementCourseRevenue(
          item.courseId,
          item.priceCents,
          tx,
        );
        await this.repo.incrementInstructorEarnings(
          course.instructorId,
          item.priceCents,
          tx,
        );
      }

      await this.repo.incrementStudentTotalSpent(
        order.userId,
        order.totalCents,
        tx,
      );

      if (order.couponCode) {
        await this.repo.incrementCouponUsed(order.couponCode, tx);
        await this.repo.createCouponRedemption(
          {
            couponCode: order.couponCode,
            orderId: order.id,
            userId: order.userId,
          },
          tx,
        );
      }
    });

    // Credit any attributed sales-agent referral now that payment succeeded.
    await this.salesAgents.confirmReferral(orderId);

    const updated = await this.findById(orderId);

    // Receipt email — fire-and-forget: the purchase is already complete and a
    // mail failure must not turn a paid order into an error response.
    void this.emailReceipt(orderId).catch(() => undefined);

    return this.toDto(updated!);
  }

  private async emailReceipt(orderId: string): Promise<void> {
    const order = await this.repo.findByIdWithUser(orderId);
    if (!order || order.status !== "PAID") return;
    const pdf = await this.receiptPdf(order.userId, orderId);
    await this.email.sendReceipt(
      order.user.email,
      order.user.name,
      {
        id: order.id,
        totalCents: order.totalCents,
        currency: order.currency,
        items: order.items.map((i) => ({ title: i.titleSnapshot })),
      },
      pdf,
    );
  }
}
