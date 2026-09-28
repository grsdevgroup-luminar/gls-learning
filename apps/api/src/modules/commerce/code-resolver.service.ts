import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { Db } from "../../common/types";

export type ResolvedCodeType = "coupon" | "campaign" | "unknown";

/** One code field, two possible tables. `Coupon.code` is admin-chosen and
 *  freeform; `DeliveryPartnerCampaign.code` is system-generated (`CMP-` +
 *  hex). They live in separate tables, so telling them apart needs one
 *  lookup against each — used by both CartService.setCode and
 *  CheckoutService.quote so the two never disagree about a code's type. */
@Injectable()
export class CodeResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveType(code: string, tx?: Db): Promise<ResolvedCodeType> {
    const db = tx ?? this.prisma;
    const [coupon, campaign] = await Promise.all([
      db.coupon.findUnique({ where: { code }, select: { code: true } }),
      db.deliveryPartnerCampaign.findUnique({ where: { code }, select: { code: true } }),
    ]);
    if (campaign) return "campaign";
    if (coupon) return "coupon";
    return "unknown";
  }
}
