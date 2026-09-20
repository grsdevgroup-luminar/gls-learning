import { z } from "zod";
import type { OrderStatus, PaymentGateway } from "../enums.js";

export const checkoutQuoteSchema = z.object({
  courseIds: z.array(z.string().min(1)).min(1),
  couponCode: z.string().trim().optional(),
  /** A delivery-partner campaign code, entered manually at checkout — unlike
   *  `referralCode` below (silent, link-driven, attribution-only), this one
   *  is an explicit discount code and mutually exclusive with couponCode:
   *  sending both is a client bug, rejected by CheckoutService.quote rather
   *  than silently preferring one. */
  campaignCode: z.string().trim().optional(),
  regionCode: z.string().optional(),
  /** When true, deduct available store credit from the total after coupon.
   *  See REFUND_TO_CREDIT_PLAN.md. */
  applyCredit: z.boolean().optional(),
});
export type CheckoutQuoteInput = z.infer<typeof checkoutQuoteSchema>;

export const checkoutSessionSchema = checkoutQuoteSchema.extend({
  gateway: z.enum(["STRIPE", "PAYPAL", "SSLCOMMERZ"]),
  /** Optional delivery-partner referral code for commission attribution only
   *  — captured silently from a `?ref=` link, never discounts. Distinct from
   *  `campaignCode` above; a valid campaignCode takes priority over this for
   *  both the discount and the commission attribution on this order. */
  referralCode: z.string().trim().optional(),
});
export type CheckoutSessionInput = z.infer<typeof checkoutSessionSchema>;

export interface QuoteLineDto {
  courseId: string;
  title: string;
  basePriceCents: number;
  priceCents: number; // after regional/PPP adjustment
}

export interface QuoteCouponDto {
  code: string;
  valid: boolean;
  message: string;
  discountCents: number;
}

export interface QuoteCampaignDto {
  code: string;
  valid: boolean;
  message: string;
  discountCents: number;
  /** Shown alongside the discount so the buyer knows whose code they used. */
  partnerName: string | null;
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
  coupon: QuoteCouponDto | null;
  /** Mutually exclusive with `coupon` — at most one of the two is non-null. */
  campaign: QuoteCampaignDto | null;
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
  /** Set when this order was attributed to a delivery partner — refunding it
   *  will proportionally reverse that partner's commission. */
  partnerReferralCode: string | null;
  /** Set when this order used a delivery-partner campaign code instead of a
   *  plain referral-link attribution — same commission/refund-reversal path,
   *  just a different origin. Mutually exclusive with couponCode. */
  partnerCampaignCode: string | null;
}

/** Aggregate spend stats for the caller's own orders (drives billing sidebar). */
export interface MyOrderStatsDto {
  totalSpentCents: number;
  paidCount: number;
}
