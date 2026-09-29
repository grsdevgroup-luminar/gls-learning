import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { AutomationRule, ReminderTrigger } from "@prisma/client";
import { Queue } from "bullmq";
import { completionPct } from "@skillstream/shared";
import { firstName } from "../../common/utils/text";
import { NOTIFICATIONS_QUEUE } from "./jobs.constants";
import type { ReminderJobData } from "./notifications.processor";
import { AutomationRepository } from "./automation.repository";

// ponytail: thresholds are per-trigger constants, not per-rule config. The
// AutomationRule.condition column is admin-facing prose ("No activity for 8
// days"), not a parsed DSL, and the spec only keys rules by trigger. If per-rule
// numbers are ever needed, add structured columns and read them here instead.
const IDLE_DAYS = 8;
const LOW_PROGRESS_DAYS = 21;
const LOW_PROGRESS_PCT = 10;
const ABANDONED_CART_HOURS = 4.5;
const ALMOST_DONE_PCT = 85;
const NEW_CONTENT_DAYS = 7;

/** How long before the same rule may contact the same user again. Without this
 *  an hourly sweep would re-notify every idle learner every hour. */
const COOLDOWN_HOURS: Record<ReminderTrigger, number> = {
  IDLE: 24 * 7,
  LOW_PROGRESS: 24 * 7,
  ABANDONED_CART: 24,
  ALMOST_DONE: 24 * 7,
  NEW_CONTENT: 24 * 7,
};

/** One person to contact, plus the values their rule's template can interpolate. */
interface Target {
  userId: string;
  vars: Record<string, string>;
  href: string;
  ctaLabel: string;
}

/** Per-trigger CTA — enrollment-based triggers deep-link to the course player;
 *  abandoned cart goes to checkout. Paths are relative; EmailService prefixes
 *  FRONTEND_URL. */
const REMINDER_CTA: Record<
  ReminderTrigger,
  { label: string; href: (courseSlug: string | null) => string }
> = {
  IDLE: {
    label: "Continue learning",
    href: (slug) => (slug ? `/learn/${slug}` : "/dashboard"),
  },
  LOW_PROGRESS: {
    label: "Continue learning",
    href: (slug) => (slug ? `/learn/${slug}` : "/dashboard"),
  },
  ALMOST_DONE: {
    label: "Finish your course",
    href: (slug) => (slug ? `/learn/${slug}` : "/dashboard"),
  },
  ABANDONED_CART: {
    label: "Complete payment",
    href: () => "/checkout",
  },
  NEW_CONTENT: {
    label: "View new lessons",
    href: (slug) => (slug ? `/learn/${slug}` : "/dashboard"),
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
      const targets = await this.audienceFor(rule.trigger, now);
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
    const since = hoursAgo(now, COOLDOWN_HOURS[rule.trigger]);
    const recent = await this.repo.findRecentReminder(userId, rule.id, since);
    return recent !== null;
  }

  private audienceFor(trigger: ReminderTrigger, now: Date): Promise<Target[]> {
    switch (trigger) {
      case "IDLE":
        return this.idleLearners(now);
      case "LOW_PROGRESS":
        return this.lowProgress(now);
      case "ABANDONED_CART":
        return this.abandonedCarts(now);
      case "ALMOST_DONE":
        return this.almostDone();
      case "NEW_CONTENT":
        return this.newContent(now);
    }
  }

  // ── audiences ─────────────────────────────────────────────────────────────

  private async idleLearners(now: Date): Promise<Target[]> {
    const rows = await this.enrollmentsInProgress("IDLE", {
      lastActivityAt: { lt: daysAgo(now, IDLE_DAYS) },
    });
    return rows.map((r) => r.target);
  }

  private async lowProgress(now: Date): Promise<Target[]> {
    const rows = await this.enrollmentsInProgress("LOW_PROGRESS", {
      enrolledAt: { lt: daysAgo(now, LOW_PROGRESS_DAYS) },
    });
    return rows.filter((r) => r.pct <= LOW_PROGRESS_PCT).map((r) => r.target);
  }

  private async almostDone(): Promise<Target[]> {
    const rows = await this.enrollmentsInProgress("ALMOST_DONE", {});
    return rows.filter((r) => r.pct >= ALMOST_DONE_PCT).map((r) => r.target);
  }

  /** No Cart table exists — a checkout that never completed is an Order left in
   *  PENDING, which is the only server-side signal of an abandoned cart. */
  private async abandonedCarts(now: Date): Promise<Target[]> {
    const orders = await this.repo.findPendingOrders(
      hoursAgo(now, ABANDONED_CART_HOURS),
    );
    const cta = REMINDER_CTA.ABANDONED_CART;
    return orders.map((o) => ({
      userId: o.userId,
      vars: {
        first_name: firstName(o.user.name),
        course: o.items[0]?.course.title ?? "your cart",
        progress: "0",
      },
      href: cta.href(o.items[0]?.course.slug ?? null),
      ctaLabel: cta.label,
    }));
  }

  /** The course gained an edit since the learner last touched it. */
  private async newContent(now: Date): Promise<Target[]> {
    const rows = await this.enrollmentsInProgress("NEW_CONTENT", {
      course: { updatedAt: { gte: daysAgo(now, NEW_CONTENT_DAYS) } },
    });
    return rows
      .filter((r) => r.courseUpdatedAt > r.lastActivityAt)
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
          lastActivityAt: e.lastActivityAt,
          courseUpdatedAt: e.course.updatedAt,
          target: {
            userId: e.userId,
            vars: {
              first_name: firstName(e.user.name),
              course: e.course.title,
              progress: String(pct),
            },
            href: cta.href(e.course.slug),
            ctaLabel: cta.label,
          } satisfies Target,
        };
      }),
    );
  }
}
