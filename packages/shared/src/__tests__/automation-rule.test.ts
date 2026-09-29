import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUTOMATION_PARAMS,
  automationConditionFromParams,
  parseAutomationRuleParams,
} from "../contracts/automation-params";
import { upsertAutomationRuleSchema } from "../contracts/admin";

const base = {
  name: "Idle learners",
  channels: ["EMAIL"] as const,
  template: "Continue learning",
  active: true,
  cooldownHours: 168,
};

describe("automation rule params validation", () => {
  it("accepts IDLE params with defaults", () => {
    expect(
      upsertAutomationRuleSchema.parse({
        ...base,
        trigger: "IDLE",
        params: DEFAULT_AUTOMATION_PARAMS.IDLE,
      }),
    ).toMatchObject({ params: { inactiveDays: 8 } });
  });

  it("accepts custom LOW_PROGRESS thresholds", () => {
    expect(
      upsertAutomationRuleSchema.parse({
        ...base,
        trigger: "LOW_PROGRESS",
        params: { enrolledDays: 14, maxProgressPct: 15 },
      }),
    ).toMatchObject({ params: { enrolledDays: 14, maxProgressPct: 15 } });
  });

  it("accepts fractional ABANDONED_CART hours", () => {
    expect(
      upsertAutomationRuleSchema.parse({
        ...base,
        trigger: "ABANDONED_CART",
        params: { pendingHours: 4.5 },
      }),
    ).toMatchObject({ params: { pendingHours: 4.5 } });
  });

  it("rejects IDLE params with wrong shape", () => {
    expect(
      upsertAutomationRuleSchema.safeParse({
        ...base,
        trigger: "IDLE",
        params: { enrolledDays: 21 },
      }).success,
    ).toBe(false);
  });

  it("rejects out-of-range progress percentages", () => {
    expect(
      upsertAutomationRuleSchema.safeParse({
        ...base,
        trigger: "ALMOST_DONE",
        params: { minProgressPct: 101 },
      }).success,
    ).toBe(false);
  });
});

describe("automation rule cooldown validation", () => {
  const input = {
    ...base,
    trigger: "IDLE" as const,
    params: DEFAULT_AUTOMATION_PARAMS.IDLE,
  };

  it("preserves the admin's chosen hours", () => {
    expect(upsertAutomationRuleSchema.parse({ ...input, cooldownHours: 36 }))
      .toMatchObject({ cooldownHours: 36 });
  });

  it("accepts a one-year cooldown", () => {
    expect(upsertAutomationRuleSchema.parse({ ...input, cooldownHours: 8760 }))
      .toMatchObject({ cooldownHours: 8760 });
  });

  it("accepts the minimum cooldown", () => {
    expect(upsertAutomationRuleSchema.parse({ ...input, cooldownHours: 24 }))
      .toMatchObject({ cooldownHours: 24 });
  });

  it.each([undefined, 0, -1, 23, 1.5, "24", Infinity, 8761, 2147483648])(
    "rejects invalid cooldown %s", (cooldownHours) => {
      expect(upsertAutomationRuleSchema.safeParse({ ...input, cooldownHours }).success)
        .toBe(false);
    },
  );
});

describe("parseAutomationRuleParams", () => {
  it("merges partial stored JSON with defaults", () => {
    expect(parseAutomationRuleParams("IDLE", { inactiveDays: 5 })).toEqual({
      inactiveDays: 5,
    });
  });

  it("returns null for invalid stored params", () => {
    expect(parseAutomationRuleParams("IDLE", { inactiveDays: 0 })).toBeNull();
    expect(parseAutomationRuleParams("IDLE", "bad")).toBeNull();
  });
});

describe("automationConditionFromParams", () => {
  it("describes IDLE thresholds", () => {
    expect(automationConditionFromParams("IDLE", { inactiveDays: 5 }))
      .toBe("No activity for more than 5 days");
  });

  it("describes ABANDONED_CART thresholds with decimals", () => {
    expect(automationConditionFromParams("ABANDONED_CART", { pendingHours: 4.5 }))
      .toBe("Order pending for more than 4.5 hours");
  });
});
