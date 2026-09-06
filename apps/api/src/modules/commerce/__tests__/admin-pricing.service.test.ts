import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
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
  return { service: new AdminPricingService(repo), repo };
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
