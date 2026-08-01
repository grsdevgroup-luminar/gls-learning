import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";

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
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Reject anything a bad feed could hand us before it reaches the DB. */
  private isSaneRate(rate: unknown): rate is number {
    return typeof rate === "number" && Number.isFinite(rate) && rate > 0 && rate < 100_000;
  }

  async refresh(): Promise<{ updated: number; skipped: string[] } | { error: string }> {
    const url = this.config.get("FX_RATES_URL", { infer: true });

    let rates: Record<string, unknown>;
    try {
      // Timeout so a hung feed can't wedge the queue worker.
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { result?: string; rates?: Record<string, unknown> };
      // open.er-api.com reports failure in the body with a 200 status.
      if (body.result && body.result !== "success") throw new Error(`feed result=${body.result}`);
      if (!body.rates || typeof body.rates !== "object") throw new Error("no rates in response");
      rates = body.rates;
    } catch (err) {
      const error = (err as Error).message;
      this.logger.warn(`FX refresh failed, keeping last known rates: ${error}`);
      return { error };
    }

    const regions = await this.prisma.region.findMany({
      select: { code: true, currency: true, fxRate: true },
    });

    let updated = 0;
    const skipped: string[] = [];
    for (const region of regions) {
      // USD is the base — always exactly 1, never worth a feed round-trip.
      const rate = region.currency === "USD" ? 1 : rates[region.currency];
      if (!this.isSaneRate(rate)) {
        skipped.push(region.currency);
        continue;
      }
      // Sub-0.01% moves aren't visible in a rounded display hint; skip the write.
      if (Math.abs(rate - region.fxRate) / region.fxRate < 0.0001) continue;
      await this.prisma.region.update({
        where: { code: region.code },
        data: { fxRate: rate, fxUpdatedAt: new Date() },
      });
      updated += 1;
    }

    if (skipped.length > 0) {
      this.logger.warn(`FX refresh: no rate for ${skipped.join(", ")} — left unchanged`);
    }
    this.logger.log(`FX refresh: updated ${updated}/${regions.length} regions`);
    return { updated, skipped };
  }
}
