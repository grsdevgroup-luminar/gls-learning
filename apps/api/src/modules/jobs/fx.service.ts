import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";
import { fetchUsdRates, rateFromFeed } from "./fx-feed";
import { FxRepository } from "./fx.repository";

/**
 * Refreshes `Region.fxRate` (USD -> local) from a public rates feed.
 *
 * The rate is display-only: every order is charged in USD (see
 * `checkout.service.ts`), so a stale rate misprints the "≈ ৳5,850" hint but can
 * never mischarge anyone. That's why a failed fetch keeps the last known rate
 * rather than falling back to something synthetic — an old rate is a far better
 * approximation than a wrong one, and `fxUpdatedAt` records how old it is.
 */
@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);

  constructor(
    private readonly repo: FxRepository,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async refresh(): Promise<{ updated: number; skipped: string[] } | { error: string }> {
    const url = this.config.get("FX_RATES_URL", { infer: true });

    let rates: Record<string, unknown>;
    try {
      rates = await fetchUsdRates(url);
    } catch (err) {
      const error = (err as Error).message;
      this.logger.warn(`FX refresh failed, keeping last known rates: ${error}`);
      return { error };
    }

    const regions = await this.repo.findAllRegions();

    let updated = 0;
    const skipped: string[] = [];
    for (const region of regions) {
      // USD is the base — always exactly 1, never worth a feed round-trip.
      if (region.currency === "USD") continue;
      const rate = rateFromFeed(rates, region.currency);
      if (rate === undefined) {
        skipped.push(region.currency);
        continue;
      }
      // Always stamp fxUpdatedAt on a successful check. Skipping the write when
      // the number hasn't moved left the old timestamp in place, so a healthy
      // feed still looked stale after FX_STALE_AFTER_MS.
      await this.repo.updateRegionRate(region.code, rate, new Date());
      if (Math.abs(rate - region.fxRate) / region.fxRate >= 0.0001) {
        updated += 1;
      }
    }

    if (skipped.length > 0) {
      this.logger.warn(`FX refresh: no rate for ${skipped.join(", ")} — left unchanged`);
    }
    this.logger.log(`FX refresh: updated ${updated}/${regions.length} regions`);
    return { updated, skipped };
  }
}
