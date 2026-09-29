import { z } from "zod";
import { ReminderTrigger } from "../enums.js";

/** Eligibility thresholds keyed by trigger — stored in AutomationRule.params. */
export const DEFAULT_AUTOMATION_PARAMS = {
  IDLE: { inactiveDays: 8 },
  LOW_PROGRESS: { enrolledDays: 21, maxProgressPct: 10 },
  ABANDONED_CART: { pendingHours: 4.5 },
  ALMOST_DONE: { minProgressPct: 85 },
  NEW_CONTENT: { lookbackDays: 7 },
} as const;

export type IdleAutomationParams = z.infer<typeof idleParamsSchema>;
export type LowProgressAutomationParams = z.infer<typeof lowProgressParamsSchema>;
export type AbandonedCartAutomationParams = z.infer<typeof abandonedCartParamsSchema>;
export type AlmostDoneAutomationParams = z.infer<typeof almostDoneParamsSchema>;
export type NewContentAutomationParams = z.infer<typeof newContentParamsSchema>;

export type AutomationParamsByTrigger = {
  IDLE: IdleAutomationParams;
  LOW_PROGRESS: LowProgressAutomationParams;
  ABANDONED_CART: AbandonedCartAutomationParams;
  ALMOST_DONE: AlmostDoneAutomationParams;
  NEW_CONTENT: NewContentAutomationParams;
};

export const idleParamsSchema = z.object({
  inactiveDays: z.number().int().min(1).max(365),
});

export const lowProgressParamsSchema = z.object({
  enrolledDays: z.number().int().min(1).max(365),
  maxProgressPct: z.number().min(0).max(100),
});

export const abandonedCartParamsSchema = z.object({
  pendingHours: z.number().min(0.25).max(168),
});

export const almostDoneParamsSchema = z.object({
  minProgressPct: z.number().min(0).max(100),
});

export const newContentParamsSchema = z.object({
  lookbackDays: z.number().int().min(1).max(90),
});

const PARAM_SCHEMAS = {
  IDLE: idleParamsSchema,
  LOW_PROGRESS: lowProgressParamsSchema,
  ABANDONED_CART: abandonedCartParamsSchema,
  ALMOST_DONE: almostDoneParamsSchema,
  NEW_CONTENT: newContentParamsSchema,
} as const satisfies Record<ReminderTrigger, z.ZodType>;

/** Admin-facing prose derived from params — not parsed by the sweep. */
export function automationConditionFromParams<T extends ReminderTrigger>(
  trigger: T,
  params: AutomationParamsByTrigger[T],
): string {
  if (trigger === "IDLE") {
    const p = params as IdleAutomationParams;
    return `No activity for more than ${p.inactiveDays} days`;
  }
  if (trigger === "LOW_PROGRESS") {
    const p = params as LowProgressAutomationParams;
    return `Enrolled for more than ${p.enrolledDays} days, progress at most ${p.maxProgressPct}%`;
  }
  if (trigger === "ABANDONED_CART") {
    const p = params as AbandonedCartAutomationParams;
    return `Order pending for more than ${p.pendingHours} hours`;
  }
  if (trigger === "ALMOST_DONE") {
    const p = params as AlmostDoneAutomationParams;
    return `Progress at least ${p.minProgressPct}%`;
  }
  const p = params as NewContentAutomationParams;
  return `Lessons added within the last ${p.lookbackDays} days, after the learner's last activity`;
}

/** Merge stored JSON with defaults, then validate. Returns null when invalid. */
export function parseAutomationRuleParams<T extends ReminderTrigger>(
  trigger: T,
  raw: unknown,
): AutomationParamsByTrigger[T] | null {
  if (raw !== null && raw !== undefined && (typeof raw !== "object" || Array.isArray(raw))) {
    return null;
  }
  const defaults = DEFAULT_AUTOMATION_PARAMS[trigger];
  const merged =
    raw && typeof raw === "object"
      ? { ...defaults, ...(raw as Record<string, unknown>) }
      : defaults;
  const result = PARAM_SCHEMAS[trigger].safeParse(merged);
  return result.success ? (result.data as AutomationParamsByTrigger[T]) : null;
}

/** Like parseAutomationRuleParams, but always returns usable values (e.g. missing DB column). */
export function resolveAutomationRuleParams<T extends ReminderTrigger>(
  trigger: T,
  raw?: unknown,
): AutomationParamsByTrigger[T] {
  return parseAutomationRuleParams(trigger, raw) ?? DEFAULT_AUTOMATION_PARAMS[trigger];
}
