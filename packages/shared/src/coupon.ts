// ---------------------------------------------------------------------------
// Coupon validation + discount math. Pure and shared: the API uses it as the
// authoritative calculation at checkout; the frontend uses it for live preview.
// All money in integer cents. Ported from the prototype's lib/mock/coupons.ts.
// ---------------------------------------------------------------------------

import { CouponType, CouponScope } from "./enums.js";

export interface CouponLike {
  code: string;
  type: CouponType;
  value: number; // percent (0-100) for PERCENT, cents for FIXED, ignored for FREE
  description: string;
  minSpendCents?: number | null;
  scope: CouponScope;
  courseId?: string | null;
  expiresAt: string | Date;
  usageLimit: number;
  used: number;
  active: boolean;
}

export interface CouponResult {
  ok: boolean;
  message: string;
  coupon?: CouponLike;
}

/**
 * Validate a coupon against a cart subtotal (cents) and the course ids in cart.
 * `now` is injected so the API (real clock) and tests (fixed clock) agree.
 */
export function validateCoupon(
  coupon: CouponLike | undefined | null,
  subtotalCents: number,
  courseIds: string[],
  now: Date = new Date(),
): CouponResult {
  if (!coupon) return { ok: false, message: "That code isn't valid." };
  if (!coupon.active || new Date(coupon.expiresAt) < now)
    return { ok: false, message: "This coupon has expired." };
  if (coupon.used >= coupon.usageLimit)
    return { ok: false, message: "This coupon has reached its usage limit." };
  if (coupon.minSpendCents && subtotalCents < coupon.minSpendCents)
    return {
      ok: false,
      message: `Spend at least $${(coupon.minSpendCents / 100).toFixed(0)} to use this code.`,
    };
  if (
    coupon.scope === CouponScope.COURSE &&
    coupon.courseId &&
    !courseIds.includes(coupon.courseId)
  )
    return { ok: false, message: "This code only applies to a specific course." };
  return { ok: true, message: coupon.description, coupon };
}

/** Discount amount in cents, never exceeding the subtotal. */
export function discountCents(coupon: CouponLike, subtotalCents: number): number {
  if (coupon.type === CouponType.PERCENT)
    return Math.round(subtotalCents * (coupon.value / 100));
  if (coupon.type === CouponType.FREE) return subtotalCents;
  return Math.min(coupon.value, subtotalCents);
}
