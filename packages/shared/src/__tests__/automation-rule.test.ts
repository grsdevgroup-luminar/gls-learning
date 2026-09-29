import { describe, expect, it } from "vitest";
import { upsertAutomationRuleSchema } from "../contracts/admin";

const input = {
  name: "Idle learners", trigger: "IDLE", channels: ["EMAIL"],
  template: "Continue learning", active: true,
};

describe("automation rule cooldown validation", () => {
  it("preserves the admin's chosen hours", () => {
    expect(upsertAutomationRuleSchema.parse({ ...input, cooldownHours: 36 }))
      .toMatchObject({ cooldownHours: 36 });
  });

  it("accepts a one-year cooldown", () => {
    expect(upsertAutomationRuleSchema.parse({ ...input, cooldownHours: 8760 }))
      .toMatchObject({ cooldownHours: 8760 });
  });

  it.each([undefined, 0, -1, 1.5, "24", Infinity, 8761, 2147483648])(
    "rejects invalid cooldown %s", (cooldownHours) => {
      expect(upsertAutomationRuleSchema.safeParse({ ...input, cooldownHours }).success)
        .toBe(false);
    },
  );
});
