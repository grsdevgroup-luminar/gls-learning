import { BadRequestException, Injectable } from "@nestjs/common";
import type {
  CheckoutQuoteInput,
  CheckoutSessionInput,
  CheckoutSessionDto,
  QuoteDto,
  QuoteLineDto,
} from "@skillstream/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PricingService } from "./pricing.service";
import { CouponsService } from "./coupons.service";
import { OrdersService } from "./orders.service";
import { PaymentsService } from "../payments/payments.service";
import { SalesAgentService } from "../sales-agent/sales-agent.service";

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly coupons: CouponsService,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly salesAgents: SalesAgentService,
  ) {}

  private async buildLines(
    courseIds: string[],
    regionCode?: string,
  ): Promise<{ lines: QuoteLineDto[]; region: Awaited<ReturnType<PricingService["resolveRegion"]>> }> {
    const region = await this.pricing.resolveRegion(regionCode);
    const courses = await this.prisma.course.findMany({
      where: { id: { in: courseIds }, status: "PUBLISHED" },
      select: { id: true, title: true, basePriceCents: true },
    });
    const lines = courses.map((c) => ({
      courseId: c.id,
      title: c.title,
      basePriceCents: c.basePriceCents,
      priceCents: this.pricing.priceForCourse(c.basePriceCents, region),
    }));
    return { lines, region };
  }

  async quote(input: CheckoutQuoteInput): Promise<QuoteDto> {
    const { lines, region } = await this.buildLines(
      input.courseIds,
      input.regionCode,
    );
    const subtotalCents = lines.reduce((s, l) => s + l.priceCents, 0);

    let discountCents = 0;
    let coupon: QuoteDto["coupon"] = null;
    if (input.couponCode) {
      const ev = await this.coupons.evaluate(
        input.couponCode,
        subtotalCents,
        lines.map((l) => l.courseId),
      );
      discountCents = ev.discountCents;
      coupon = {
        code: input.couponCode.trim().toUpperCase(),
        valid: ev.result.ok,
        message: ev.result.message,
        discountCents: ev.discountCents,
      };
    }

    return {
      lines,
      subtotalCents,
      discountCents,
      totalCents: Math.max(0, subtotalCents - discountCents),
      currency: "USD",
      regionCode: region.code,
      coupon,
    };
  }

  async createSession(
    userId: string,
    input: CheckoutSessionInput,
  ): Promise<CheckoutSessionDto> {
    // Never sell a course the user already owns.
    const owned = await this.prisma.enrollment.findMany({
      where: { userId, courseId: { in: input.courseIds } },
      select: { courseId: true },
    });
    const ownedSet = new Set(owned.map((o) => o.courseId));
    const courseIds = input.courseIds.filter((id) => !ownedSet.has(id));
    if (courseIds.length === 0)
      throw new BadRequestException("You already own these courses");

    // Recompute the quote authoritatively — client-sent prices are ignored.
    const quote = await this.quote({ ...input, courseIds });
    if (quote.lines.length === 0)
      throw new BadRequestException("No purchasable courses in cart");

    const order = await this.orders.createPending({
      userId,
      gateway: input.gateway,
      couponCode: quote.coupon?.valid ? quote.coupon.code : null,
      subtotalCents: quote.subtotalCents,
      discountCents: quote.discountCents,
      totalCents: quote.totalCents,
      currency: quote.currency,
      items: quote.lines.map((l) => ({
        courseId: l.courseId,
        title: l.title,
        priceCents: l.priceCents,
      })),
    });

    // Attribute a sales-agent referral (pending until the order is paid).
    if (input.referralCode)
      await this.salesAgents.createPendingReferral(order.id, input.referralCode);

    // Free orders (100%-off coupon or $0 courses) fulfil immediately.
    if (quote.totalCents === 0) {
      await this.orders.fulfill(order.id, "free");
      return {
        orderId: order.id,
        gateway: input.gateway,
        redirectUrl: this.payments.successUrl(order.id),
      };
    }

    return this.payments.startPayment(order, input.gateway);
  }
}
