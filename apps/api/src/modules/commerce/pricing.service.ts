import { Injectable } from "@nestjs/common";
import { DEFAULT_REGION, regionalPriceCents, type RegionRow } from "@skillstream/shared";
import { PricingRepository } from "./pricing.repository";

@Injectable()
export class PricingService {
  constructor(private readonly repo: PricingRepository) {}

  getRegions() {
    return this.repo.findAllRegions();
  }

  async resolveRegion(code?: string): Promise<RegionRow> {
    const region =
      (code &&
        (await this.repo.findRegionByCode(code))) ||
      (await this.repo.findRegionByCode(DEFAULT_REGION));
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
