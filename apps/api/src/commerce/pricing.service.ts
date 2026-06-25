import { Injectable } from "@nestjs/common";
import { DEFAULT_REGION, regionalPriceCents, type RegionRow } from "@skillstream/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  getRegions() {
    return this.prisma.region.findMany({ orderBy: { country: "asc" } });
  }

  async resolveRegion(code?: string): Promise<RegionRow> {
    const region =
      (code &&
        (await this.prisma.region.findUnique({ where: { code } }))) ||
      (await this.prisma.region.findUnique({ where: { code: DEFAULT_REGION } }));
    if (!region) {
      // Fallback when regions aren't seeded — full price, USD.
      return {
        code: DEFAULT_REGION,
        country: "United States",
        flag: "🇺🇸",
        currency: "USD",
        symbol: "$",
        locale: "en-US",
        fxRate: 1,
        multiplier: 1,
        tierId: "t1",
      };
    }
    return {
      code: region.code,
      country: region.country,
      flag: region.flag,
      currency: region.currency,
      symbol: region.symbol,
      locale: region.locale,
      fxRate: region.fxRate,
      multiplier: region.multiplier,
      tierId: region.tierId ?? "t1",
      override: region.override,
    };
  }

  priceForCourse(baseCents: number, region: RegionRow): number {
    return regionalPriceCents(baseCents, region);
  }
}
