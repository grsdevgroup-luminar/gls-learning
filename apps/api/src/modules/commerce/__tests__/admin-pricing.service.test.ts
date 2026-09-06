import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { AdminPricingService } from "../admin-pricing.service";
import type { PricingRepository } from "../pricing.repository";

function makeService(repoOverrides: Partial<PricingRepository> = {}) {
  const repo = {
    findRegionByCode: vi.fn().mockResolvedValue(null),
    findTierById: vi.fn().mockResolvedValue(null),
    createRegion: vi.fn().mockResolvedValue({}),
    findAllTiersAndRegions: vi.fn().mockResolvedValue([[], []]),
    ...repoOverrides,
  } as unknown as PricingRepository;
  const config = { get: () => "https://fx.example/latest/USD" };
  return { service: new AdminPricingService(repo, config as never), repo };
}

const baseInput = {
  code: "FR",
  currency: "EUR",
  symbol: "€",
  fxRate: 0.92,
};

describe("AdminPricingService.createRegion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an unknown tierId even when a custom multiplier is supplied", async () => {
    const { service, repo } = makeService();
    await expect(
      service.createRegion({
        ...baseInput,
        tierId: "missing-tier",
        multiplier: 0.5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.findTierById).toHaveBeenCalledWith("missing-tier");
    expect(repo.createRegion).not.toHaveBeenCalled();
  });

  it("stamps fxUpdatedAt so a new non-USD rate is not stale", async () => {
    const created: Record<string, unknown>[] = [];
    const { service, repo } = makeService({
      findTierById: vi.fn().mockResolvedValue({ id: "t1", multiplier: 1 }),
      createRegion: vi.fn(async (data) => {
        created.push(data as Record<string, unknown>);
        return data;
      }),
      findAllTiersAndRegions: vi.fn().mockResolvedValue([
        [{ id: "t1", name: "Tier 1", multiplier: 1, countries: [] }],
        [
          {
            code: "FR",
            country: "France",
            flag: "🇫🇷",
            currency: "EUR",
            symbol: "€",
            locale: "en-US",
            fxRate: 0.92,
            fxUpdatedAt: new Date(),
            multiplier: 1,
            tierId: "t1",
            override: false,
          },
        ],
      ]),
    });

    const dto = await service.createRegion({ ...baseInput, tierId: "t1" });
    expect(created[0]?.fxUpdatedAt).toBeInstanceOf(Date);
    const fr = dto.regions.find((r) => r.code === "FR");
    expect(fr?.fxStale).toBe(false);
    expect(fr?.fxUpdatedAt).toBeTruthy();
  });
});

describe("AdminPricingService.lookupFxRate", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns 1 for USD without hitting the feed", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { service } = makeService();
    await expect(service.lookupFxRate("usd")).resolves.toEqual({ currency: "USD", rate: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the feed rate for a covered currency, rounded to 2 dp", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: "success", rates: { EUR: 0.92147 } }),
      }),
    );
    const { service } = makeService();
    await expect(service.lookupFxRate("eur")).resolves.toEqual({ currency: "EUR", rate: 0.92 });
  });

  it("rejects a currency the feed omits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: "success", rates: { EUR: 0.92 } }),
      }),
    );
    const { service } = makeService();
    await expect(service.lookupFxRate("BDT")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("surfaces an unreachable feed as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ETIMEDOUT")));
    const { service } = makeService();
    await expect(service.lookupFxRate("EUR")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
