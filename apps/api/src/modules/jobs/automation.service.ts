import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { AutomationRule, ReminderTrigger } from "@prisma/client";
import { Queue } from "bullmq";
import { completionPct, parseAutomationRuleParams } from "@skillstream/shared";
import { firstName } from "../../common/utils/text";
import { NOTIFICATIONS_QUEUE } from "./jobs.constants";
import type { ReminderJobData } from "./notifications.processor";
import { AutomationRepository } from "./automation.repository";

// Eligibility thresholds live in AutomationRule.params (JSONB), validated per
// trigger before each sweep. condition is admin-facing prose derived from params.

/** One person to contact, plus the values their rule's template can interpolate. */
interface Target {
  userId: string;
  vars: Record<string, string>;
  href: string;
  ctaLabel: string;
}

interface CtaContext {
  courseSlug?: string | null;
  orderId?: string;
}

/** Per-trigger CTA — enrollment-based triggers deep-link to the course player;
 *  abandoned cart resumes the specific pending order. Paths are relative;
 *  EmailService prefixes FRONTEND_URL. */
const REMINDER_CTA: Record<
  ReminderTrigger,
  { label: string; href: (ctx: CtaContext) => string }
> = {
  IDLE: {
    label: "Continue learning",
    href: ({ courseSlug }) => (courseSlug ? `/learn/${courseSlug}` : "/dashboard"),
  },
  LOW_PROGRESS: {
    label: "Continue learning",
    href: ({ courseSlug }) => (courseSlug ? `/learn/${courseSlug}` : "/dashboard"),
  },
  ALMOST_DONE: {
    label: "Finish your course",
    href: ({ courseSlug }) => (courseSlug ? `/learn/${courseSlug}` : "/dashboard"),
  },
  ABANDONED_CART: {
    label: "Complete payment",
    href: ({ orderId }) => (orderId ? `/checkout?order=${orderId}` : "/checkout"),
  },
  NEW_CONTENT: {
    label: "View new lessons",
    href: ({ courseSlug }) => (courseSlug ? `/learn/${courseSlug}` : "/dashboard"),
  },
};

const hoursAgo = (now: Date, h: number) => new Date(now.getTime() - h * 3600_000);
const daysAgo = (now: Date, d: number) => hoursAgo(now, d * 24);

/** Fills {{placeholders}}; unknown keys are left as-is so a typo in a template
 *  is visible in the log rather than silently blanked. */
export function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, key: string) =>
    key in vars ? vars[key] : whole,
  );
}

/**
 * The producer half of marketing automation: finds who currently matches each
 * active rule and enqueues reminder jobs onto the notifications queue, where
 * NotificationsProcessor delivers them. Idempotent within a cooldown window and
 * safe to re-run.
 */
@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly repo: AutomationRepository,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
  ) {}

  async sweep(now: Date = new Date()): Promise<{ enqueued: number }> {
    const rules = await this.repo.findActiveRules();

    let enqueued = 0;
    for (const rule of rules) {
      const targets = await this.audienceFor(rule, now);
      if (targets === null) {
        this.logger.warn(
          `automation sweep: skipping rule ${rule.id} (${rule.trigger}) — invalid params`,
        );
        continue;
      }

      let sentForRule = 0;

      for (const target of targets) {
        if (await this.inCooldown(rule, target.userId, now)) continue;
        for (const channel of rule.channels) {
          const data: ReminderJobData = {
            userId: target.userId,
            channel,
            trigger: rule.trigger,
            subject: renderTemplate(rule.template, target.vars),
            href: target.href,
            ctaLabel: target.ctaLabel,
            ruleId: rule.id,
          };
          await this.queue.add("reminder", data, {
            removeOnComplete: 100,
            removeOnFail: 100,
            attempts: 3,
            backoff: { type: "exponential", delay: 30_000 },
          });
          enqueued += 1;
        }
        sentForRule += 1;
      }

      if (sentForRule > 0)
        await this.repo.incrementRuleSentCount(rule.id, sentForRule);
    }

    this.logger.log(`automation sweep: ${enqueued} reminder(s) enqueued`);
    return { enqueued };
  }

  /** ponytail: the cooldown reads ReminderLog, which the processor writes on
   *  delivery, so a reminder enqueued but not yet processed isn't visible here.
   *  The sweep runs hourly and jobs drain in seconds, so the overlap is
   *  negligible; if it ever matters, record the intent at enqueue time instead. */
  private async inCooldown(
    rule: AutomationRule,
    userId: string,
    now: Date,
  ): Promise<boolean> {
    const since = hoursAgo(now, rule.cooldownHours);
    const recent = await this.repo.findRecentReminder(userId, rule.id, since);
    return recent !== null;
  }

  private async audienceFor(rule: AutomationRule, now: Date): Promise<Target[] | null> {
    switch (rule.trigger) {
      case "IDLE": {
        const params = parseAutomationRuleParams("IDLE", rule.params);
        if (!params) return null;
        return this.idleLearners(now, params.inactiveDays);
      }
      case "LOW_PROGRESS": {
        const params = parseAutomationRuleParams("LOW_PROGRESS", rule.params);
        if (!params) return null;
        return this.lowProgress(now, params.enrolledDays, params.maxProgressPct);
      }
      case "ABANDONED_CART": {
        const params = parseAutomationRuleParams("ABANDONED_CART", rule.params);
        if (!params) return null;
        return this.abandonedCarts(now, params.pendingHours);
      }
      case "ALMOST_DONE": {
        const params = parseAutomationRuleParams("ALMOST_DONE", rule.params);
        if (!params) return null;
        return this.almostDone(params.minProgressPct);
      }
      case "NEW_CONTENT": {
        const params = parseAutomationRuleParams("NEW_CONTENT", rule.params);
        if (!params) return null;
        return this.newContent(now, params.lookbackDays);
      }
    }
  }

  // ── audiences ─────────────────────────────────────────────────────────────

  private async idleLearners(now: Date, inactiveDays: number): Promise<Target[]> {
    const rows = await this.enrollmentsInProgress("IDLE", {
      lastActivityAt: { lt: daysAgo(now, inactiveDays) },
    });
    return rows.map((r) => r.target);
  }

  private async lowProgress(
    now: Date,
    enrolledDays: number,
    maxProgressPct: number,
  ): Promise<Target[]> {
    const rows = await this.enrollmentsInProgress("LOW_PROGRESS", {
      enrolledAt: { lt: daysAgo(now, enrolledDays) },
    });
    return rows.filter((r) => r.pct <= maxProgressPct).map((r) => r.target);
  }

  private async almostDone(minProgressPct: number): Promise<Target[]> {
    const rows = await this.enrollmentsInProgress("ALMOST_DONE", {});
    return rows.filter((r) => r.pct >= minProgressPct).map((r) => r.target);
  }

  /** No Cart table exists — a checkout that never completed is an Order left in
   *  PENDING, which is the only server-side signal of an abandoned cart. */
  private async abandonedCarts(now: Date, pendingHours: number): Promise<Target[]> {
    const orders = await this.repo.findPendingOrders(hoursAgo(now, pendingHours));
    const cta = REMINDER_CTA.ABANDONED_CART;
    return orders.map((o) => ({
      userId: o.userId,
      vars: {
        first_name: firstName(o.user.name),
        course: o.items[0]?.course.title ?? "your cart",
        progress: "0",
      },
      href: cta.href({ orderId: o.id }),
      ctaLabel: cta.label,
    }));
  }

  /** A new lesson was added since the learner last studied the course. */
  private async newContent(now: Date, lookbackDays: number): Promise<Target[]> {
    const since = daysAgo(now, lookbackDays);
    const rows = await this.enrollmentsInProgress("NEW_CONTENT", {});
    if (rows.length === 0) return [];

    const courseIds = [...new Set(rows.map((r) => r.courseId))];
    const latestLessonAt = await this.repo.findLatestLessonAddedAt(courseIds);

    return rows
      .filter((r) => {
        const addedAt = latestLessonAt.get(r.courseId);
        return addedAt && addedAt >= since && addedAt > r.lastActivityAt;
      })
      .map((r) => r.target);
  }

  // ── shared enrollment lookup ──────────────────────────────────────────────

  /** Loads IN_PROGRESS enrollments matching `where`, with completion percent
   *  computed via the same shared helper the UI and API use. */
  private async enrollmentsInProgress(trigger: ReminderTrigger, where: object) {
    const enrollments = await this.repo.findInProgressEnrollments(where);
    const cta = REMINDER_CTA[trigger];

    const lessonTotals = new Map<string, number>();
    const totalFor = async (courseId: string) => {
      const cached = lessonTotals.get(courseId);
      if (cached !== undefined) return cached;
      const total = await this.repo.countLessonsByCourse(courseId);
      lessonTotals.set(courseId, total);
      return total;
    };

    return Promise.all(
      enrollments.map(async (e) => {
        const pct = completionPct(
          e._count.lessonProgress,
          await totalFor(e.courseId),
        );
        return {
          pct,
          courseId: e.courseId,
          lastActivityAt: e.lastActivityAt,
          target: {
            userId: e.userId,
            vars: {
              first_name: firstName(e.user.name),
              course: e.course.title,
              progress: String(pct),
            },
            href: cta.href({ courseSlug: e.course.slug }),
            ctaLabel: cta.label,
          } satisfies Target,
        };
      }),
    );
  }
}
