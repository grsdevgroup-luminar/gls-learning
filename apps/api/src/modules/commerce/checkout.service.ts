import {
  BadRequestException, ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import type {
  CheckoutQuoteInput,
  CheckoutSessionInput,
  CheckoutSessionDto,
  QuoteDto,
  QuoteLineDto,
} from "@skillstream/shared";
import { UsersService } from "../users/users.service";
import { GeoIpService } from "../geoip/geoip.service";
import { PricingService } from "./pricing.service";
import { CouponsService } from "./coupons.service";
import { OrdersService } from "./orders.service";
import { OrdersRepository, type OrderRow } from "./orders.repository";
import { PaymentsService } from "../payment/payments.service";
import { DeliveryPartnerService } from "../delivery-partner/delivery-partner.service";
import { CreditsService } from "../credits/credits.service";

/** Only `[A-Za-z0-9_-]{1,128}` allowed. Anything else is a client bug or an
 *  attempt to abuse the unique index with pathological inputs. */
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{1,128}$/;

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly repo: OrdersRepository,
    private readonly pricing: PricingService,
    private readonly coupons: CouponsService,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly deliveryPartners: DeliveryPartnerService,
    private readonly users: UsersService,
    private readonly geoIp: GeoIpService,
    private readonly credits: CreditsService,
  ) {}

  private async buildLines(
    courseIds: string[],
    regionCode?: string,
  ): Promise<{ lines: QuoteLineDto[]; region: Awaited<ReturnType<PricingService["resolveRegion"]>> }> {
    const region = await this.pricing.resolveRegion(regionCode);
    const courses = await this.repo.findPublishedCoursesByIds(courseIds);
    const lines = courses.map((c) => ({
      courseId: c.id,
      title: c.title,
      basePriceCents: c.basePriceCents,
      priceCents: this.pricing.priceForCourse(c.basePriceCents, region),
    }));
    return { lines, region };
  }

  async quote(input: CheckoutQuoteInput, userId?: string): Promise<QuoteDto> {
    // Mutually exclusive by design (only one discount code applies at a
    // time) — the storefront UI makes this state unreachable, but a client
    // bug shouldn't silently mis-price an order, so it's rejected here too.
    if (input.couponCode && input.campaignCode) {
      throw new BadRequestException(
        "Only one code — a coupon or a partner referral code — can be applied at a time",
      );
    }

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
        lines.map((l) => ({ courseId: l.courseId, priceCents: l.priceCents })),
      );
      discountCents = ev.discountCents;
      coupon = {
        code: input.couponCode.trim().toUpperCase(),
        valid: ev.result.ok,
        message: ev.result.message,
        discountCents: ev.discountCents,
      };
    }

    let campaign: QuoteDto["campaign"] = null;
    if (input.campaignCode) {
      const ev = await this.deliveryPartners.evaluateCampaign(input.campaignCode, subtotalCents);
      discountCents = ev.discountCents;
      campaign = {
        code: input.campaignCode.trim().toUpperCase(),
        valid: ev.result.ok,
        message: ev.result.message,
        discountCents: ev.discountCents,
        partnerName: ev.result.campaign?.partnerName ?? null,
      };
    }

    const currency = "USD";
    const afterCoupon = Math.max(0, subtotalCents - discountCents);

    // Store credit is only meaningful for authenticated callers. Balance is
    // aggregated over the ledger — SUM of signed rows. Anonymous quotes always
    // report zero balance and cannot apply credit.
    const availableCreditCents = userId
      ? Math.max(0, await this.credits.getBalance(userId, currency))
      : 0;
    const creditAppliedCents =
      input.applyCredit && userId
        ? Math.min(availableCreditCents, afterCoupon)
        : 0;
    const totalCents = Math.max(0, afterCoupon - creditAppliedCents);

    return {
      lines,
      subtotalCents,
      discountCents,
      creditAppliedCents,
      availableCreditCents,
      totalCents,
      currency,
      regionCode: region.code,
      coupon,
      campaign,
    };
  }

  /** Admin gateway kill-switch (PlatformSettings). Enforced here, server-side —
   *  the storefront hiding a button is not a control. */
  private async assertGatewayEnabled(
    gateway: "STRIPE" | "PAYPAL" | "SSLCOMMERZ",
  ) {
    const settings = await this.repo.findPlatformSettings();
    if (!settings) return; // never configured — nothing disabled yet
    const enabled =
      gateway === "STRIPE"
        ? settings.stripeEnabled
        : gateway === "PAYPAL"
          ? settings.paypalEnabled
          : settings.sslcommerzEnabled;
    if (!enabled) {
      const label =
        gateway === "STRIPE"
          ? "Card"
          : gateway === "PAYPAL"
            ? "PayPal"
            : "SSLCommerz";
      throw new BadRequestException(
        `${label} payments are currently unavailable`,
      );
    }
  }

  async createSession(
    userId: string,
    input: CheckoutSessionInput,
    clientIpAddress: string | null,
    idempotencyKey?: string,
  ): Promise<CheckoutSessionDto> {
    await this.assertGatewayEnabled(input.gateway);

    // Idempotency: replayed requests with the same key resolve to the same
    // Order, and — if we already spun up a gateway session — the same redirect
    // URL. A payload mismatch means the client reused a key across two
    // different carts; that's a bug on their side, refuse rather than leak a
    // stale session.
    const key = this.normalizeIdempotencyKey(idempotencyKey);
    if (key) {
      const existing = await this.repo.findOrderByIdempotencyKey(userId, key);
      if (existing) {
        this.assertSamePayload(existing, input);
        return this.resurrectSession(existing);
      }
    }
    await this.assertCheckoutLocation(userId, clientIpAddress);

    // Never sell a course the user already owns.
    const owned = await this.repo.findOwnedEnrollments(userId, input.courseIds);
    const ownedSet = new Set(owned.map((o) => o.courseId));
    const purchasableCourseIds = [...new Set(input.courseIds)].filter(
      (id) => !ownedSet.has(id),
    );
    if (purchasableCourseIds.length === 0)
      throw new BadRequestException("You already own these courses");

    // A new checkout attempt may use a fresh idempotency key (for example
    // after returning from a canceled provider session). Do not create a
    // second pending order for a course that is already awaiting payment.
    // Mixed carts continue with only the courses that do not have a pending
    // order; the existing pending order remains available to resume.
    const openOrders =
      await this.repo.findPendingOrdersByUserAndCourseIds(
        userId,
        purchasableCourseIds,
    );
    // Choosing a different payment method abandons the earlier attempt. Without
    // this, the pending order from the previous gateway would be resurrected
    // and the user sent back to the gateway they just switched away from.
    await Promise.all(
      openOrders
        .filter((order) => order.gateway !== input.gateway)
        .map((order) => this.repo.markFailedIfPending(order.id, userId)),
    );
    const remainingPendingOrders = openOrders.filter(
      (order) => order.gateway === input.gateway,
    );
    const pendingCourseIds = new Set(
      remainingPendingOrders.flatMap((order) => order.items.map((item) => item.courseId)),
    );
    const newCourseIds = purchasableCourseIds.filter(
      (id) => !pendingCourseIds.has(id),
    );
    if (newCourseIds.length === 0)
      return this.resurrectSession(remainingPendingOrders[0]);

    // Recompute the quote authoritatively — client-sent prices are ignored.
    const quote = await this.quote({ ...input, courseIds: newCourseIds }, userId);
    if (quote.lines.length === 0)
      throw new BadRequestException("No purchasable courses in cart");

    // Persist the resolved region on the order so admin revenue analytics can
    // attribute the payment even when the user profile has no country set.
    const region = await this.pricing.resolveRegion(quote.regionCode);

    const order = await this.orders.createPending({
      userId,
      country: region.country,
      gateway: input.gateway,
      couponCode: quote.coupon?.valid ? quote.coupon.code : null,
      subtotalCents: quote.subtotalCents,
      discountCents: quote.discountCents,
      creditAppliedCents: quote.creditAppliedCents,
      totalCents: quote.totalCents,
      currency: quote.currency,
      idempotencyKey: key,
      items: quote.lines.map((l) => ({
        courseId: l.courseId,
        title: l.title,
        priceCents: l.priceCents,
      })),
    });

    // Credit is not debited yet — the SPEND_CHECKOUT ledger row is written
    // inside orders.fulfill() (the PENDING→PAID transition) so a checkout that
    // never completes doesn't drain the wallet. `order.creditAppliedCents`
    // carries the intent forward. See REFUND_TO_CREDIT_PLAN.md.

    // Attribute a delivery-partner referral (pending until the order is
    // paid) when checkout used a valid campaign code — the only attribution
    // mechanism. A no-op otherwise.
    await this.deliveryPartners.createPendingReferral(
      order.id,
      quote.campaign?.valid ? quote.campaign.code : null,
    );

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

  private normalizeIdempotencyKey(raw: string | undefined): string | undefined {
    if (!raw) return undefined;
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    if (!IDEMPOTENCY_KEY_RE.test(trimmed))
      throw new BadRequestException("Invalid Idempotency-Key");
    return trimmed;
  }

  /** Guards against a client reusing an Idempotency-Key across different
   *  carts. If we returned the stored session in that case, the user would
   *  see prices/items they didn't ask for. */
  private assertSamePayload(order: OrderRow, input: CheckoutSessionInput): void {
    if (order.gateway !== input.gateway)
      throw new ConflictException("Idempotency-Key reused with a different gateway");

    const storedCourseIds = order.items.map((i) => i.courseId).sort().join(",");
    const requestedCourseIds = [...input.courseIds].sort().join(",");
    if (storedCourseIds !== requestedCourseIds)
      throw new ConflictException("Idempotency-Key reused with different courses");

    const storedCoupon = order.couponCode ?? "";
    const requestedCoupon = input.couponCode?.trim().toUpperCase() ?? "";
    if (storedCoupon !== requestedCoupon)
      throw new ConflictException("Idempotency-Key reused with a different coupon");

    const storedCampaign = order.campaignCode ?? "";
    const requestedCampaign = input.campaignCode?.trim().toUpperCase() ?? "";
    if (storedCampaign !== requestedCampaign)
      throw new ConflictException("Idempotency-Key reused with a different referral code");
  }

  /** For a replay, prefer the cached gateway URL so we don't open a second
   *  session at Stripe/PayPal/SSLCommerz. When the order is already settled
   *  (paid via webhook between the two client attempts), hand back the
   *  success URL — the client's redirect logic will do the right thing. */
  private async resurrectSession(order: OrderRow): Promise<CheckoutSessionDto> {
    if (order.status !== "PENDING") {
      return {
        orderId: order.id,
        gateway: order.gateway,
        redirectUrl: this.payments.successUrl(order.id),
      };
    }
    if (order.providerRedirectUrl) {
      return {
        orderId: order.id,
        gateway: order.gateway,
        redirectUrl: order.providerRedirectUrl,
        providerRef: order.providerRef ?? undefined,
      };
    }
    // First attempt never got as far as the gateway (e.g. crash between
    // createPending and startPayment). Try again — startPayment is safe to
    // call twice for the same order because the provider-side idempotency key
    // is derived from order.id.
    return this.payments.startPayment(order, order.gateway);
  }

  /** Block checkout when VPN/proxy is detected or GeoIP country ≠ profile country. */
  private async assertCheckoutLocation(
    userId: string,
    clientIpAddress: string | null,
  ): Promise<void> {
    if (!this.geoIp.checkoutEnabled) return;

    const user = await this.users.findById(userId);
    const verdict = this.geoIp.verifyCheckout(
      clientIpAddress,
      user?.country ?? null,
    );
    this.logger.log(
      `Checkout geo user=${userId} ip=${clientIpAddress ?? "null"} profileCountry=${user?.country ?? "null"} allowed=${verdict.allowed}${verdict.allowed ? "" : ` reason=${verdict.reason}`}`,
    );
    if (verdict.allowed) return;

    const message = this.geoIp.messageFor(verdict);
    if (!message) return;

    if (verdict.reason === "missing_profile_country") {
      throw new BadRequestException(message);
    }
    if (verdict.reason === "verification_unavailable") {
      throw new ServiceUnavailableException(message);
    }
    throw new ForbiddenException(message);
  }
}
