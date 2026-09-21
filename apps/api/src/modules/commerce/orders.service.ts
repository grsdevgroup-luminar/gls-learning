import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PaymentGateway, Prisma } from "@prisma/client";
import type {
  MyOrderStatsDto,
  OrderDto,
  Paginated,
  SearchQuery,
} from "@skillstream/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { receiptPdf } from "../../common/utils/pdf";
import { EmailService } from "../email/email.service";
import { EnrollmentService } from "../enrollment/enrollment.service";
import { DeliveryPartnerService } from "../delivery-partner/delivery-partner.service";
import {
  NotificationsService,
  type NotifyInput,
} from "../notifications/notifications.service";
import { CreditsService } from "../credits/credits.service";
import { OrdersRepository, type OrderRow } from "./orders.repository";
import { CartService } from "./cart.service";

export interface CreateOrderInput {
  userId: string;
  country?: string;
  gateway: PaymentGateway;
  couponCode: string | null;
  subtotalCents: number;
  discountCents: number;
  creditAppliedCents?: number;
  totalCents: number;
  currency: string;
  items: { courseId: string; title: string; priceCents: number }[];
  /** Client-supplied Idempotency-Key from POST /checkout/session, if any. */
  idempotencyKey?: string | null;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: OrdersRepository,
    private readonly enrollment: EnrollmentService,
    private readonly deliveryPartners: DeliveryPartnerService,
    private readonly email: EmailService,
    private readonly cart: CartService,
    private readonly notifications: NotificationsService,
    private readonly credits: CreditsService,
  ) {}

  private toDto(row: OrderRow): OrderDto {
    return {
      id: row.id,
      status: row.status,
      gateway: row.gateway,
      subtotalCents: row.subtotalCents,
      discountCents: row.discountCents,
      creditAppliedCents: row.creditAppliedCents,
      totalCents: row.totalCents,
      currency: row.currency,
      couponCode: row.couponCode,
      items: row.items.map((i) => ({
        id: i.id,
        courseId: i.courseId,
        title: i.titleSnapshot,
        priceCents: i.priceCents,
        refundedCents: i.refundedCents,
      })),
      refundedCents: row.refundedCents,
      createdAt: row.createdAt.toISOString(),
      paidAt: row.paidAt?.toISOString() ?? null,
      partnerCampaignCode: row.campaignCode,
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
      creditAppliedCents: input.creditAppliedCents ?? 0,
      totalCents: input.totalCents,
      currency: input.currency,
      status: "PENDING",
      idempotencyKey: input.idempotencyKey ?? null,
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
    if (
      order.status !== "PAID" &&
      order.status !== "REFUNDED" &&
      order.status !== "PARTIALLY_REFUNDED"
    )
      throw new BadRequestException("No receipt for an unpaid order");

    return await receiptPdf({
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
      creditAppliedCents: order.creditAppliedCents,
      totalCents: order.totalCents,
      refundedCents: order.refundedCents,
      items: order.items.map((i) => ({
        title: i.titleSnapshot,
        priceCents: i.priceCents,
        refundedCents: i.refundedCents,
      })),
    });
  }

  async myOrders(
    userId: string,
    query: SearchQuery,
  ): Promise<Paginated<OrderDto>> {
    const q = query.q?.trim();
    // Restrict to caller's own orders and, when a search term is present,
    // match against the case-sensitive order id or a case-insensitive
    // purchased course title (order items). Order IDs are identifiers, so
    // their letter casing must be preserved during search.
    const where: Prisma.OrderWhereInput = {
      userId,
      ...(q
        ? {
            OR: [
              { id: { contains: q } },
              {
                items: {
                  some: {
                    titleSnapshot: { contains: q, mode: "insensitive" },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.repo.findOrdersPageByUser(
      where,
      query.page,
      query.pageSize,
    );
    return {
      items: rows.map((r) => this.toDto(r)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  /** A single order, scoped to its owner — 404 for another account's order,
   *  never a leak. Powers the checkout success page's fast poll for
   *  payment confirmation (see NOTIFICATION_SYSTEM_PLAN.md). */
  async myOrder(userId: string, orderId: string): Promise<OrderDto> {
    const order = await this.repo.findByIdAndUserWithUser(orderId, userId);
    if (!order) throw new NotFoundException("Order not found");
    return this.toDto(order);
  }

  /**
   * Records an explicit provider cancellation. A payment webhook can arrive
   * concurrently, so the repository only changes an order that is still
   * PENDING; a settled order remains settled.
   */
  async cancelPending(userId: string, orderId: string): Promise<OrderDto> {
    const order = await this.repo.findByIdAndUserWithUser(orderId, userId);
    if (!order) throw new NotFoundException("Order not found");
    if (order.status === "PENDING") {
      await this.repo.markFailedIfPending(orderId, userId);
    }
    const updated = await this.repo.findById(orderId);
    if (!updated) throw new NotFoundException("Order not found");
    return this.toDto(updated);
  }

  async myOrderStats(userId: string): Promise<MyOrderStatsDto> {
    const agg = await this.repo.aggregatePaidByUser(userId);
    return {
      totalSpentCents: agg._sum.totalCents ?? 0,
      paidCount: agg._count._all,
    };
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

    const courseNames = order.items.map((i) => i.titleSnapshot).join(", ");
    const notifyInput: NotifyInput = {
      userId: order.userId,
      event: "ORDER_PAID",
      title: "Payment confirmed",
      body: `Your order for ${courseNames} is paid — you're enrolled.`,
      href: "/dashboard/billing",
    };

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

      // In-app write only — enqueuing the email here (inside the transaction)
      // risks a send before/without a commit, since BullMQ writes to Redis
      // immediately. The email fan-out happens after this block resolves.
      await this.notifications.notify(notifyInput, tx);

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
        // In-app only (P3, no email) — see NOTIFICATION_SYSTEM_PLAN.md's
        // Phase 3 taxonomy. Never fanned out post-commit, unlike ORDER_PAID.
        await this.notifications.notify(
          {
            userId: course.instructorId,
            event: "COURSE_NEW_ENROLLMENT",
            title: "New enrollment",
            body: `A student enrolled in "${item.titleSnapshot}".`,
            href: `/instructor/courses/${item.courseId}/edit`,
            skipEmail: true,
          },
          tx,
        );
      }

      // In-app only, no email — same Phase 3 ambient pattern as
      // COURSE_NEW_ENROLLMENT above. Admins already have an opt-in email
      // alert for new enrollments (AdminAlertsService.newEnrollment); this is
      // the in-app feed the admin notification bell was missing entirely.
      await this.notifications.notifyAdmins(
        {
          event: "ORDER_NEW_PURCHASE",
          title: "New course purchase",
          body: `A student purchased ${courseNames} for $${(order.totalCents / 100).toFixed(2)}.`,
          href: "/admin/orders",
          skipEmail: true,
        },
        tx,
      );

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

      // Debit store credit in the same tx as the PENDING→PAID transition, so a
      // rollback keeps the ledger in sync with the order. If the balance
      // shifted between quote and fulfillment (extremely narrow window since
      // gateway callbacks serialize per order), we cap the spend at whatever
      // is currently available — never let SUM(amountCents) go negative.
      if (order.creditAppliedCents > 0) {
        const currentBalance = await this.credits.getBalance(
          order.userId,
          order.currency,
          tx,
        );
        const spend = Math.min(currentBalance, order.creditAppliedCents);
        if (spend > 0) {
          await this.credits.spendAtCheckout(
            {
              userId: order.userId,
              amountCents: spend,
              currency: order.currency,
              orderId: order.id,
            },
            tx,
          );
        }
      }

      // Payment settled — the cart that produced this order is no longer valid.
      // Same transaction as fulfilment so a rollback keeps the cart intact.
      await this.cart.resetOnFulfilled(order.userId, tx);
    });

    // Credit any attributed delivery-partner referral now that payment succeeded.
    await this.deliveryPartners.confirmReferral(orderId);

    const updated = await this.findById(orderId);

    // Receipt email and the ORDER_PAID notification email — both fire-and-
    // forget now that the transaction has actually committed: the purchase is
    // already complete and neither send failing should turn a paid order into
    // an error response.
    void this.emailReceipt(orderId).catch(() => undefined);
    void this.notifications.notifyEmailAfterCommit(notifyInput).catch(() => undefined);

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
