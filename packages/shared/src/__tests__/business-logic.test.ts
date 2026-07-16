import { describe, it, expect } from "vitest";
import { regionalPriceCents } from "../pricing.js";
import {
  validateCoupon,
  discountCents,
  couponStatus,
  type CouponLike,
} from "../coupon.js";
import { completionPct, isCourseComplete, quizPassed } from "../progress.js";
import { CouponType, CouponScope } from "../enums.js";

describe("regionalPriceCents", () => {
  it("leaves full-price (multiplier 1) regions untouched", () => {
    expect(regionalPriceCents(4999, { multiplier: 1 })).toBe(4999);
  });
  it("applies PPP discount rounded to .99", () => {
    // 4999 * 0.45 = 2249.55 -> floor to $22 -> 2299
    expect(regionalPriceCents(4999, { multiplier: 0.45 })).toBe(2299);
  });
  it("never returns below zero", () => {
    expect(regionalPriceCents(0, { multiplier: 0.3 })).toBe(99);
  });
});

describe("validateCoupon / discountCents", () => {
  const base: CouponLike = {
    code: "LAUNCH40",
    type: CouponType.PERCENT,
    value: 40,
    description: "40% off",
    scope: CouponScope.GLOBAL,
    expiresAt: "2099-01-01",
    usageLimit: 100,
    used: 1,
    active: true,
  };
  const now = new Date("2026-06-25");

  it("rejects unknown coupons", () => {
    expect(validateCoupon(undefined, 5000, [], now).ok).toBe(false);
  });
  it("rejects expired coupons", () => {
    expect(
      validateCoupon({ ...base, expiresAt: "2025-01-01" }, 5000, [], now).ok,
    ).toBe(false);
  });
  it("rejects when usage limit reached", () => {
    expect(
      validateCoupon({ ...base, used: 100 }, 5000, [], now).ok,
    ).toBe(false);
  });
  it("enforces minimum spend", () => {
    expect(
      validateCoupon({ ...base, minSpendCents: 6000 }, 5000, [], now).ok,
    ).toBe(false);
  });
  it("treats usageLimit 0 as unlimited (the schema default)", () => {
    expect(
      validateCoupon({ ...base, usageLimit: 0, used: 9999 }, 5000, [], now).ok,
    ).toBe(true);
  });
  it("enforces course scope", () => {
    const c = { ...base, scope: CouponScope.COURSE, courseId: "c_react" };
    expect(validateCoupon(c, 5000, ["c_python"], now).ok).toBe(false);
    expect(validateCoupon(c, 5000, ["c_react"], now).ok).toBe(true);
  });
  it("computes percent / fixed / free discounts", () => {
    expect(discountCents(base, 5000)).toBe(2000);
    expect(
      discountCents({ ...base, type: CouponType.FIXED, value: 1000 }, 5000),
    ).toBe(1000);
    expect(
      discountCents({ ...base, type: CouponType.FIXED, value: 9999 }, 5000),
    ).toBe(5000);
    expect(discountCents({ ...base, type: CouponType.FREE }, 5000)).toBe(5000);
  });
});

describe("couponStatus", () => {
  const base: CouponLike = {
    code: "LAUNCH40",
    type: CouponType.PERCENT,
    value: 40,
    description: "40% off",
    scope: CouponScope.GLOBAL,
    expiresAt: "2099-01-01",
    usageLimit: 100,
    used: 1,
    active: true,
  };
  const now = new Date("2026-06-25");

  it("reports active", () => expect(couponStatus(base, now)).toBe("active"));
  it("reports disabled ahead of expiry", () =>
    expect(
      couponStatus({ ...base, active: false, expiresAt: "2025-01-01" }, now),
    ).toBe("disabled"));
  it("reports expired", () =>
    expect(couponStatus({ ...base, expiresAt: "2025-01-01" }, now)).toBe(
      "expired",
    ));
  it("reports limit-reached", () =>
    expect(couponStatus({ ...base, used: 100 }, now)).toBe("limit-reached"));
  it("stays active at an unlimited cap", () =>
    expect(couponStatus({ ...base, usageLimit: 0, used: 9999 }, now)).toBe(
      "active",
    ));
});

describe("progress", () => {
  it("computes completion percent", () => {
    expect(completionPct(3, 12)).toBe(25);
    expect(completionPct(0, 0)).toBe(0);
  });
  it("detects course completion", () => {
    expect(isCourseComplete(12, 12)).toBe(true);
    expect(isCourseComplete(11, 12)).toBe(false);
  });
  it("grades quizzes by pass threshold", () => {
    expect(quizPassed(80, 70)).toBe(true);
    expect(quizPassed(60, 70)).toBe(false);
  });
});
