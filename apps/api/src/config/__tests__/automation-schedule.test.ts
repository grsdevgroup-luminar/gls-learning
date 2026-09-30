import { describe, expect, it } from "vitest";
import {
  automationSweepCronPattern,
  formatAutomationSweepTime,
  parseAutomationSweepTime,
} from "../automation-schedule";

describe("parseAutomationSweepTime", () => {
  it("parses HH:MM:SS", () => {
    expect(parseAutomationSweepTime("00:00:00")).toEqual({
      hour: 0,
      minute: 0,
      second: 0,
    });
    expect(parseAutomationSweepTime("14:30:00")).toEqual({
      hour: 14,
      minute: 30,
      second: 0,
    });
  });

  it("parses HH:MM with zero seconds", () => {
    expect(parseAutomationSweepTime("9:05")).toEqual({
      hour: 9,
      minute: 5,
      second: 0,
    });
  });

  it("rejects invalid times", () => {
    expect(parseAutomationSweepTime("24:00:00")).toBeNull();
    expect(parseAutomationSweepTime("12:60:00")).toBeNull();
    expect(parseAutomationSweepTime("")).toBeNull();
  });
});

describe("automationSweepCronPattern", () => {
  it("maps midnight to a daily cron", () => {
    expect(automationSweepCronPattern("00:00:00")).toBe("0 0 0 * * *");
  });

  it("maps an afternoon time to cron fields", () => {
    expect(automationSweepCronPattern("14:30")).toBe("0 30 14 * * *");
  });
});

describe("formatAutomationSweepTime", () => {
  it("zero-pads short hour forms", () => {
    expect(formatAutomationSweepTime("9:05")).toBe("09:05:00");
  });
});
