import { describe, it, expect } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFS,
  resolveNotificationPrefs,
  updateNotificationPreferencesSchema,
} from "@skillstream/shared";

describe("resolveNotificationPrefs", () => {
  it("fills every trigger when nothing is stored", () => {
    expect(resolveNotificationPrefs(null)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(resolveNotificationPrefs({})).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it("keeps stored opt-outs and defaults the rest", () => {
    const prefs = resolveNotificationPrefs({ IDLE: { email: false } });
    expect(prefs.IDLE).toEqual({ email: false, sms: false });
    expect(prefs.ALMOST_DONE).toEqual(DEFAULT_NOTIFICATION_PREFS.ALMOST_DONE);
  });

  it("ignores unknown triggers left over from an older shape", () => {
    const prefs = resolveNotificationPrefs({ promotions: { email: false } });
    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(prefs).not.toHaveProperty("promotions");
  });
});

describe("updateNotificationPreferencesSchema", () => {
  it("accepts a sparse patch", () => {
    const parsed = updateNotificationPreferencesSchema.parse({
      IDLE: { email: false },
    });
    expect(parsed).toEqual({ IDLE: { email: false } });
  });

  it("rejects unknown triggers and non-boolean channels", () => {
    expect(
      updateNotificationPreferencesSchema.safeParse({ PROMOS: { email: false } })
        .success,
    ).toBe(false);
    expect(
      updateNotificationPreferencesSchema.safeParse({ IDLE: { email: "no" } })
        .success,
    ).toBe(false);
  });
});
