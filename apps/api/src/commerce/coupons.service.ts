import { Injectable } from "@nestjs/common";
import { Coupon } from "@prisma/client";
import {
  couponStatus,
  discountCents,
  validateCoupon,
  type CouponLike,
  type CouponResult,
  type FeaturedCouponDto,
} from "@skillstream/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  findByCode(code: string): Promise<Coupon | null> {
    return this.prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
  }

  private toCouponLike(c: Coupon): CouponLike {
    return {
      code: c.code,
      type: c.type,
      value: c.value,
      description: c.description,
      minSpendCents: c.minSpendCents,
      scope: c.scope,
      courseId: c.courseId,
      expiresAt: c.expiresAt,
      usageLimit: c.usageLimit,
      used: c.used,
      active: c.active,
    };
  }

  /** The single promoted coupon for the storefront banner, or null when none is
   *  featured or the featured one is no longer usable (disabled/expired/capped). */
  async featured(): Promise<FeaturedCouponDto | null> {
    const c = await this.prisma.coupon.findFirst({ where: { featured: true } });
    if (!c || couponStatus(this.toCouponLike(c)) !== "active") return null;
    return {
      code: c.code,
      type: c.type,
      value: c.value,
      description: c.description,
      minSpendCents: c.minSpendCents,
      expiresAt: c.expiresAt.toISOString(),
    };
  }

  /** Validates a code and computes its discount against the cart. */
  async evaluate(
    code: string,
    subtotalCents: number,
    courseIds: string[],
  ): Promise<{ result: CouponResult; coupon: Coupon | null; discountCents: number }> {
    const coupon = await this.findByCode(code);
    const like = coupon ? this.toCouponLike(coupon) : null;
    const result = validateCoupon(like, subtotalCents, courseIds);
    const discount = result.ok && like ? discountCents(like, subtotalCents) : 0;
    return { result, coupon, discountCents: discount };
  }
}
