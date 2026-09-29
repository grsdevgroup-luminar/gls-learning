import { describe, it, expect, vi } from "vitest";
import type { AutomationRule } from "@prisma/client";
import type { Queue } from "bullmq";
import { AutomationService, renderTemplate } from "../automation.service";
import type { AutomationRepository } from "../automation.repository";

describe("renderTemplate", () => {
  const vars = { first_name: "Ada", course: "Python for Everybody", progress: "42" };

  it("interpolates every placeholder in a real rule template", () => {
    expect(
      renderTemplate(
        "Hi {{first_name}}, your {{course}} is waiting — you're {{progress}}% there!",
        vars,
      ),
    ).toBe("Hi Ada, your Python for Everybody is waiting — you're 42% there!");
  });

  it("repeats a placeholder used more than once", () => {
    expect(renderTemplate("{{course}} / {{course}}", vars)).toBe(
      "Python for Everybody / Python for Everybody",
    );
  });

  it("leaves unknown placeholders visible rather than blanking them", () => {
    expect(renderTemplate("Hi {{nope}}", vars)).toBe("Hi {{nope}}");
  });

  it("passes through templates with no placeholders", () => {
    expect(renderTemplate("Come back!", vars)).toBe("Come back!");
  });
});

describe("automation cooldowns", () => {
  const now = new Date("2026-09-29T12:00:00Z");
  const lastSent = new Date("2026-09-27T12:00:00Z");
  const rule = (id: string, cooldownHours: number) => ({
    id, cooldownHours, trigger: "ABANDONED_CART", channels: ["EMAIL"],
    template: "Complete your order", active: true, name: id,
    condition: "", sentCount: 0, createdAt: now, updatedAt: now,
  } satisfies AutomationRule);

  function setup(rules: AutomationRule[]) {
    const jobs: Array<{ ruleId: string }> = [];
    const repo = {
      findActiveRules: async () => rules,
      findPendingOrders: async () => [{
        id: "order_1", userId: "user_1", user: { name: "Ada" }, items: [],
      }],
      findRecentReminder: async (_userId: string, _ruleId: string, since: Date) =>
        lastSent >= since ? { id: "log_1" } : null,
      incrementRuleSentCount: vi.fn().mockResolvedValue(undefined),
    } as unknown as AutomationRepository;
    const queue = {
      add: async (_name: string, data: { ruleId: string }) => { jobs.push(data); },
    } as unknown as Queue;
    return { service: new AutomationService(repo, queue), jobs };
  }

  it("uses each rule's saved cooldown even when the trigger is identical", async () => {
    const { service, jobs } = setup([rule("short", 24), rule("long", 72)]);
    expect(await service.sweep(now)).toEqual({ enqueued: 1 });
    expect(jobs.map((job) => job.ruleId)).toEqual(["short"]);
  });

  it("uses an admin's changed cooldown on the next sweep against existing logs", async () => {
    const savedRule = rule("editable", 72);
    const { service, jobs } = setup([savedRule]);
    expect(await service.sweep(now)).toEqual({ enqueued: 0 });
    savedRule.cooldownHours = 24;
    expect(await service.sweep(now)).toEqual({ enqueued: 1 });
    expect(jobs.map((job) => job.ruleId)).toEqual(["editable"]);
  });
});
