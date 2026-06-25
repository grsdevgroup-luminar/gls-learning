import { z } from "zod";
import type { OrderStatus, PaymentGateway } from "../enums.js";

export const checkoutQuoteSchema = z.object({
  courseIds: z.array(z.string().min(1)).min(1),
  couponCode: z.string().trim().optional(),
  regionCode: z.string().optional(),
});
export type CheckoutQuoteInput = z.infer<typeof checkoutQuoteSchema>;

export const checkoutSessionSchema = checkoutQuoteSchema.extend({
  gateway: z.enum(["STRIPE", "PAYPAL"]),
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

export interface QuoteDto {
  lines: QuoteLineDto[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  regionCode: string;
  coupon: QuoteCouponDto | null;
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
  courseId: string;
  title: string;
  priceCents: number;
}

export interface OrderDto {
  id: string;
  status: OrderStatus;
  gateway: PaymentGateway;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  couponCode: string | null;
  items: OrderItemDto[];
  createdAt: string;
  paidAt: string | null;
}
