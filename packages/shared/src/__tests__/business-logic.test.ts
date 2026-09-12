import { describe, it, expect } from "vitest";
import { regionalPriceCents, rawPriceCentsForRegionalBound } from "../pricing.js";
import {
  validateCoupon,
  discountCents,
  couponStatus,
  type CouponLike,
} from "../coupon.js";
import {
  completionPct,
  isCourseComplete,
  isLessonSequentiallyAccessible,
  quizPassed,
} from "../progress.js";
import { CouponType, CouponScope, SalesAgentStatus } from "../enums.js";
import { flagFor, tenderFor } from "../countries.js";
import { CreateRegionSchema, AdminFxRateQuerySchema } from "../contracts/pricing.js";
import {
  ReviewAgentApplicationSchema,
  UpdateAgentSchema,
} from "../contracts/sales-agent.js";
import { adminReviewQuerySchema, createReviewSchema } from "../contracts/reviews.js";
import { emailSchema, normalizeEmail, countryCodeSchema } from "../contracts/auth.js";
import {
  activeCourseSearchQuery,
  compactCourseSearchQuery,
  courseListQuerySchema,
  MAX_COURSE_SEARCH_LENGTH,
  normalizeCourseSearchQuery,
} from "../contracts/catalog.js";

describe("email normalization", () => {
  it("canonicalizes validated email values", () => {
    expect(normalizeEmail("  Alice  @ Example.COM  ")).toBe("alice@example.com");
    expect(emailSchema.safeParse("  Alice  @ Example.COM  ").success).toBe(false);
    expect(emailSchema.parse("Alice@example.com")).toBe("Alice@example.com");
  });
});

describe("countryCodeSchema", () => {
  it("accepts known ISO codes and rejects unknown two-letter codes", () => {
    expect(countryCodeSchema.safeParse("bd").success).toBe(true);
    expect(countryCodeSchema.parse("us")).toBe("US");
    expect(countryCodeSchema.safeParse("ZZ").success).toBe(false);
  });
});

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

describe("rawPriceCentsForRegionalBound", () => {
  it("leaves full-price (multiplier 1) regions untouched", () => {
    expect(rawPriceCentsForRegionalBound(2999, { multiplier: 1 }, "max")).toBe(2999);
    expect(rawPriceCentsForRegionalBound(3000, { multiplier: 1 }, "min")).toBe(3000);
  });
  it("round-trips against regionalPriceCents at the boundary", () => {
    // A course priced exactly at the raw bound this resolves to must land on
    // the correct side of the regional bound it was derived from.
    const region = { multiplier: 0.45 };
    const rawMax = rawPriceCentsForRegionalBound(2999, region, "max");
    expect(regionalPriceCents(rawMax, region)).toBeLessThanOrEqual(2999);
    expect(regionalPriceCents(rawMax + 1, region)).toBeGreaterThan(2999);

    const rawMin = rawPriceCentsForRegionalBound(3000, region, "min");
    expect(regionalPriceCents(rawMin, region)).toBeGreaterThanOrEqual(3000);
    expect(regionalPriceCents(rawMin - 1, region)).toBeLessThan(3000);
  });
  it("matches the live India tier (0.35) 'under $30' bucket used by the catalog filter", () => {
    // $64.99 course displays as $22.99 in India (see regionalPriceCents),
    // so it must be admitted by the raw bound for the "under $30" filter.
    const region = { multiplier: 0.35 };
    const rawMax = rawPriceCentsForRegionalBound(2999, region, "max");
    expect(6499).toBeLessThanOrEqual(rawMax);
    expect(regionalPriceCents(6499, region)).toBe(2299);
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
  it("only unlocks the next lesson in course order", () => {
    const ordered = ["lesson-1", "lesson-2", "lesson-3"];
    expect(isLessonSequentiallyAccessible(ordered, [], "lesson-1")).toBe(true);
    expect(isLessonSequentiallyAccessible(ordered, [], "lesson-2")).toBe(false);
    expect(isLessonSequentiallyAccessible(ordered, ["lesson-1"], "lesson-2")).toBe(true);
    expect(isLessonSequentiallyAccessible(ordered, ["lesson-1"], "lesson-3")).toBe(false);
    expect(isLessonSequentiallyAccessible(ordered, ["lesson-1", "lesson-2"], "lesson-3")).toBe(true);
  });
});

describe("sales agent commission validation", () => {
  it("rejects negative or zero commission during application review", () => {
    expect(
      ReviewAgentApplicationSchema.safeParse({
        status: SalesAgentStatus.APPROVED,
        commissionPercent: -10,
      }).success,
    ).toBe(false);
    expect(
      ReviewAgentApplicationSchema.safeParse({
        status: SalesAgentStatus.APPROVED,
        commissionPercent: 0,
      }).success,
    ).toBe(false);
  });

  it("accepts only 1% to 50% when updating an agent commission", () => {
    expect(UpdateAgentSchema.safeParse({ commissionPercent: 1 }).success).toBe(true);
    expect(UpdateAgentSchema.safeParse({ commissionPercent: 50 }).success).toBe(true);
    expect(UpdateAgentSchema.safeParse({ commissionPercent: 51 }).success).toBe(false);
  });
});

describe("course catalog search", () => {
  it("matches compact search text to spaced category names", () => {
    expect(compactCourseSearchQuery("datascience")).toBe(
      compactCourseSearchQuery("Data Science"),
    );
    expect(compactCourseSearchQuery("  UI/UX Design ")).toBe("uiuxdesign");
  });

  it("caps and trims catalog search queries", () => {
    const long = "a".repeat(MAX_COURSE_SEARCH_LENGTH + 50);
    expect(normalizeCourseSearchQuery(`  ${long}  `)).toHaveLength(MAX_COURSE_SEARCH_LENGTH);
    expect(activeCourseSearchQuery("a")).toBe("");
    expect(activeCourseSearchQuery("  cloud  ")).toBe("cloud");
  });

  it("rejects overlong q on the courses list endpoint", () => {
    const long = "a".repeat(MAX_COURSE_SEARCH_LENGTH + 1);
    expect(courseListQuerySchema.safeParse({ q: long, sort: "popular" }).success).toBe(false);
    expect(courseListQuerySchema.safeParse({ q: "cloud", sort: "popular" }).success).toBe(true);
  });
});

describe("adminReviewQuerySchema", () => {
  it("defaults pagination and coerces rating from query strings", () => {
    const parsed = adminReviewQuerySchema.parse({
      rating: "5",
      status: "PENDING",
      q: " audio ",
    });
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(10);
    expect(parsed.rating).toBe(5);
    expect(parsed.status).toBe("PENDING");
    expect(parsed.q).toBe("audio");
  });

  it("rejects invalid status and out-of-range rating", () => {
    expect(adminReviewQuerySchema.safeParse({ status: "all" }).success).toBe(false);
    expect(adminReviewQuerySchema.safeParse({ rating: "0" }).success).toBe(false);
  });
});

describe("createReviewSchema", () => {
  const validReview = { rating: 5, body: "Useful and clear." };

  it("requires a non-empty written review", () => {
    expect(createReviewSchema.safeParse({ ...validReview, body: "" }).success).toBe(false);
    expect(createReviewSchema.safeParse({ ...validReview, body: "   " }).success).toBe(false);
  });

  it("accepts a rating with a written review", () => {
    expect(createReviewSchema.safeParse(validReview).success).toBe(true);
  });
});

describe("CreateRegionSchema", () => {
  it("uppercases ISO codes and currency from the shared country list", () => {
    const parsed = CreateRegionSchema.parse({
      code: "fr",
      currency: "eur",
      symbol: "€",
      fxRate: 0.92,
    });
    expect(parsed.code).toBe("FR");
    expect(parsed.currency).toBe("EUR");
  });

  it("rejects unknown country codes", () => {
    expect(
      CreateRegionSchema.safeParse({
        code: "XX",
        currency: "USD",
        symbol: "$",
        fxRate: 1,
      }).success,
    ).toBe(false);
  });
});

describe("AdminFxRateQuerySchema", () => {
  it("uppercases the ISO 4217 code", () => {
    expect(AdminFxRateQuerySchema.parse({ currency: "eur" }).currency).toBe("EUR");
  });
});

describe("flagFor", () => {
  it("maps an alpha-2 code to a flag emoji", () => {
    expect(flagFor("US")).toBe("🇺🇸");
    expect(flagFor("bd")).toBe("🇧🇩");
    expect(flagFor("X")).toBe("");
  });
});

describe("tenderFor", () => {
  it("returns ISO 4217 currency and a display symbol for known countries", () => {
    expect(tenderFor("FR")).toEqual({ currency: "EUR", symbol: "€" });
    expect(tenderFor("us")).toEqual({ currency: "USD", symbol: "$" });
    expect(tenderFor("BD")).toEqual({ currency: "BDT", symbol: "৳" });
    expect(tenderFor("IN")).toEqual({ currency: "INR", symbol: "₹" });
    expect(tenderFor("BG")).toEqual({ currency: "EUR", symbol: "€" });
    expect(tenderFor("CW")).toEqual({ currency: "XCG", symbol: "Cg" });
    expect(tenderFor("SX")).toEqual({ currency: "XCG", symbol: "Cg" });
  });

  it("omits places without a well-known tender", () => {
    expect(tenderFor("AQ")).toBeUndefined();
  });
});
