import { z } from "zod";
import type { OrderStatus, PaymentGateway } from "../enums.js";

export const checkoutQuoteSchema = z.object({
  courseIds: z.array(z.string().min(1)).min(1),
  /** One discount/referral code field — the backend resolves whether it's a
   *  Coupon or a DeliveryPartnerCampaign code (see CodeResolverService); the
   *  storefront no longer asks the buyer to pick a type. */
  code: z.string().trim().optional(),
  regionCode: z.string().optional(),
  /** When true, deduct available store credit from the total after coupon.
   *  See REFUND_TO_CREDIT_PLAN.md. */
  applyCredit: z.boolean().optional(),
});
export type CheckoutQuoteInput = z.infer<typeof checkoutQuoteSchema>;

export const checkoutSessionSchema = checkoutQuoteSchema.extend({
  gateway: z.enum(["STRIPE", "PAYPAL", "SSLCOMMERZ"]),
});
export type CheckoutSessionInput = z.infer<typeof checkoutSessionSchema>;
/** Public, non-sensitive availability flags used to render checkout options. */
export interface PaymentGatewayAvailabilityDto {
  stripeEnabled: boolean;
  paypalEnabled: boolean;
  sslcommerzEnabled: boolean;
}

export interface QuoteLineDto {
  courseId: string;
  title: string;
  basePriceCents: number;
  priceCents: number; // after regional/PPP adjustment
}

export interface QuoteCouponDto {
  type: "COUPON";
  code: string;
  valid: boolean;
  message: string;
  discountCents: number;
}

export interface QuoteCampaignDto {
  type: "CAMPAIGN";
  code: string;
  valid: boolean;
  message: string;
  discountCents: number;
  /** Shown alongside the discount so the buyer knows whose code they used. */
  partnerName: string | null;
  scope: "GLOBAL" | "SPECIFIC";
  /** Course ids the discount actually applies to — all cart course ids when
   *  GLOBAL, the intersecting subset when SPECIFIC. Used by the cart/checkout
   *  UI to flag lines the code doesn't cover. */
  eligibleCourseIds: string[];
}

export interface QuoteDto {
  lines: QuoteLineDto[];
  subtotalCents: number;
  discountCents: number;
  /** Store credit deducted from the total when the caller sends
   *  applyCredit=true (0 otherwise). Reflected in `totalCents`. */
  creditAppliedCents: number;
  /** The caller's total store-credit balance in the quote's currency —
   *  displayed by the cart even when they haven't opted in yet. */
  availableCreditCents: number;
  totalCents: number;
  currency: string;
  regionCode: string;
  /** The resolved code, tagged with its type so the UI can pick the right
   *  success copy without knowing in advance which kind was entered. */
  appliedCode: QuoteCouponDto | QuoteCampaignDto | null;
}

export interface CheckoutSessionDto {
  orderId: string;
  gateway: PaymentGateway;
  /** Stripe Checkout / PayPal approve URL the client should redirect to. */
  redirectUrl?: string;
  /** Provider order/session id. */
  providerRef?: string;
  /** Dev-only token to simulate a successful payment locally. */
  devSimulateToken?: string;
}

export interface OrderItemDto {
  /** OrderItem row id — required for per-item partial refunds. */
  id: string;
  courseId: string;
  title: string;
  priceCents: number;
  /** Cumulative store credit refunded against this item. */
  refundedCents: number;
}

export interface OrderDto {
  id: string;
  status: OrderStatus;
  gateway: PaymentGateway;
  subtotalCents: number;
  discountCents: number;
  creditAppliedCents: number;
  totalCents: number;
  currency: string;
  couponCode: string | null;
  items: OrderItemDto[];
  /** Cumulative store credit refunded across all items on this order. */
  refundedCents: number;
  createdAt: string;
  paidAt: string | null;
  /** Set when this order was attributed to a delivery partner via a campaign
   *  code — refunding it will proportionally reverse that partner's
   *  commission. Mutually exclusive with couponCode. */
  partnerCampaignCode: string | null;
}

/** Aggregate spend stats for the caller's own orders (drives billing sidebar). */
export interface MyOrderStatsDto {
  totalSpentCents: number;
  paidCount: number;
}
