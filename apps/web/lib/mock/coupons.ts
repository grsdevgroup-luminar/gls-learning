import type { Coupon } from "@/types";

export const coupons: Coupon[] = [
  {
    code: "LAUNCH40",
    type: "percent",
    value: 40,
    description: "40% off everything — launch week",
    scope: "global",
    expiresAt: "2026-07-31",
    usageLimit: 5000,
    used: 2841,
    active: true,
  },
  {
    code: "WELCOME10",
    type: "fixed",
    value: 10,
    description: "$10 off your first order",
    minSpend: 40,
    scope: "global",
    expiresAt: "2026-12-31",
    usageLimit: 100000,
    used: 18402,
    active: true,
  },
  {
    code: "REACT25",
    type: "percent",
    value: 25,
    description: "25% off the Modern React Masterclass",
    scope: "course",
    courseId: "c_react",
    expiresAt: "2026-08-15",
    usageLimit: 1000,
    used: 412,
    active: true,
  },
  {
    code: "FREEPYTHON",
    type: "free",
    value: 100,
    description: "Free access to Python for Everybody (scholarship)",
    scope: "course",
    courseId: "c_python",
    expiresAt: "2026-09-01",
    usageLimit: 200,
    used: 156,
    active: true,
  },
  {
    code: "BLACKFRIDAY",
    type: "percent",
    value: 60,
    description: "Black Friday — expired",
    scope: "global",
    expiresAt: "2025-12-02",
    usageLimit: 10000,
    used: 9980,
    active: false,
  },
];

export interface CouponResult {
  ok: boolean;
  message: string;
  coupon?: Coupon;
}

// Validate a coupon against a cart subtotal (USD) and the course ids in cart.
export function validateCoupon(
  code: string,
  subtotal: number,
  courseIds: string[],
): CouponResult {
  const c = coupons.find((x) => x.code.toUpperCase() === code.trim().toUpperCase());
  if (!c) return { ok: false, message: "That code isn't valid." };
  if (!c.active || new Date(c.expiresAt) < new Date("2026-06-23"))
    return { ok: false, message: "This coupon has expired." };
  if (c.used >= c.usageLimit)
    return { ok: false, message: "This coupon has reached its usage limit." };
  if (c.minSpend && subtotal < c.minSpend)
    return { ok: false, message: `Spend at least $${c.minSpend} to use this code.` };
  if (c.scope === "course" && c.courseId && !courseIds.includes(c.courseId))
    return { ok: false, message: "This code only applies to a specific course." };
  return { ok: true, message: c.description, coupon: c };
}

export function discountAmount(c: Coupon, subtotal: number): number {
  if (c.type === "percent") return +(subtotal * (c.value / 100)).toFixed(2);
  if (c.type === "free") return subtotal;
  return Math.min(c.value, subtotal);
}
