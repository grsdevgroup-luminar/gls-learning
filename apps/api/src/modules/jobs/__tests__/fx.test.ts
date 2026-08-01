import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FxService } from "../fx.service";

// Minimal stand-ins: FxService only reaches for region.findMany/update and one
// config key, so a full Nest testing module would be ceremony with no payoff.
function makeService(regions: { code: string; currency: string; fxRate: number }[]) {
  const update = vi.fn().mockResolvedValue({});
  const prisma = { region: { findMany: vi.fn().mockResolvedValue(regions), update } };
  const config = { get: () => "https://fx.example/latest/USD" };
  const service = new FxService(prisma as never, config as never);
  return { service, update };
}

function mockFeed(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body }),
  );
}

const REGIONS = [
  { code: "US", currency: "USD", fxRate: 1 },
  { code: "BD", currency: "BDT", fxRate: 117 },
  { code: "GB", currency: "GBP", fxRate: 0.79 },
];

describe("FxService.refresh", () => {
  beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => vi.unstubAllGlobals());

  it("writes the fetched rate for currencies the feed covers", async () => {
    mockFeed({ result: "success", rates: { BDT: 122.5, GBP: 0.81 } });
    const { service, update } = makeService(REGIONS);

    const result = await service.refresh();

    expect(result).toEqual({ updated: 2, skipped: [] });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code: "BD" },
        data: expect.objectContaining({ fxRate: 122.5 }),
      }),
    );
  });

  it("never round-trips USD through the feed — the base is always exactly 1", async () => {
    // A feed that wrongly reports USD != 1 must not corrupt the base rate.
    mockFeed({ result: "success", rates: { USD: 1.07, BDT: 117, GBP: 0.79 } });
    const { service, update } = makeService(REGIONS);

    await service.refresh();

    expect(update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: "US" } }),
    );
  });

  it("keeps the last known rate when the feed is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ETIMEDOUT")));
    const { service, update } = makeService(REGIONS);

    const result = await service.refresh();

    expect(result).toEqual({ error: "ETIMEDOUT" });
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps the last known rate when the feed 200s with a failure body", async () => {
    mockFeed({ result: "error", "error-type": "invalid-key" });
    const { service, update } = makeService(REGIONS);

    expect(await service.refresh()).toEqual({ error: "feed result=error" });
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    ["zero", 0],
    ["negative", -5],
    ["absurdly large", 1e9],
    ["not a number", "122.5"],
    ["null", null],
  ])("rejects a %s rate rather than writing it", async (_label, bad) => {
    mockFeed({ result: "success", rates: { BDT: bad, GBP: 0.81 } });
    const { service, update } = makeService(REGIONS);

    const result = await service.refresh();

    expect(result).toEqual({ updated: 1, skipped: ["BDT"] });
    expect(update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: "BD" } }),
    );
  });

  it("skips currencies the feed omits, leaving their stored rate intact", async () => {
    mockFeed({ result: "success", rates: { GBP: 0.81 } });
    const { service, update } = makeService(REGIONS);

    expect(await service.refresh()).toEqual({ updated: 1, skipped: ["BDT"] });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("does not write when the rate has not meaningfully moved", async () => {
    mockFeed({ result: "success", rates: { BDT: 117.001, GBP: 0.79 } });
    const { service, update } = makeService(REGIONS);

    expect(await service.refresh()).toEqual({ updated: 0, skipped: [] });
    expect(update).not.toHaveBeenCalled();
  });
});
