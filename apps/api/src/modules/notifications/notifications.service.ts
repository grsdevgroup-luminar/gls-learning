import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import type { Notification, NotificationEvent } from "@prisma/client";
import type {
  NotificationDto,
  Paginated,
  PaginationQuery,
  UnreadCountDto,
} from "@skillstream/shared";
import type { Queue } from "bullmq";
import type { Db } from "../../common/types";
import { PrismaService } from "../../prisma/prisma.service";
import { NOTIFICATIONS_QUEUE } from "../jobs/jobs.constants";
import type { ReminderJobData } from "../jobs/notifications.processor";
import { NotificationFeedRepository } from "./notifications.repository";

export interface NotifyInput {
  userId: string;
  event: NotificationEvent;
  title: string;
  body: string;
  href?: string | null;
  /** Some events (the Phase 3 social/ambient ones — a new review, a new
   *  enrollment, a member joining an org) are in-app only by design, per the
   *  taxonomy in NOTIFICATION_SYSTEM_PLAN.md. Set true to skip the email
   *  fan-out entirely rather than just deferring it. */
  skipEmail?: boolean;
}

function toDto(row: Notification): NotificationDto {
  return {
    id: row.id,
    event: row.event,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * The single write path for every in-app notification. Callers pass the same
 * `tx` they're already inside (order fulfillment, application review, payout
 * transitions, ...) so the notification is atomic with the state change it
 * describes — never a separate follow-up call that can silently fail.
 *
 * Email fan-out is handled differently on purpose: enqueuing a BullMQ job
 * writes to Redis immediately, outside the Postgres transaction, so a job
 * enqueued from inside `tx` could be picked up and sent *before* — or even if
 * — that transaction ever commits. So `notify()` only enqueues email when
 * called with no `tx` (nothing left to roll back). When called inside a
 * transaction, the caller must separately call `notifyEmailAfterCommit()`
 * once their `$transaction` has actually resolved — see orders.service.ts,
 * instructor.service.ts, payouts.service.ts for the pattern.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly repo: NotificationFeedRepository,
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
  ) {}

  async notify(input: NotifyInput, tx?: Db): Promise<void> {
    const { skipEmail, ...data } = input;
    await this.repo.create(data, tx);
    await this.repo.incrementUnread(input.userId, tx);
    if (!tx && !skipEmail) await this.notifyEmailAfterCommit(input);
  }

  /** Enqueues the email fan-out for an event whose in-app write already
   *  committed. The delivery-time preference check happens in
   *  NotificationsProcessor, same as every reminder — this always enqueues. */
  async notifyEmailAfterCommit(input: NotifyInput): Promise<void> {
    const data: ReminderJobData = {
      userId: input.userId,
      channel: "EMAIL",
      trigger: input.event,
      subject: input.title,
      body: input.body,
      href: input.href ?? undefined,
    };
    await this.queue.add("reminder", data, {
      removeOnComplete: 100,
      removeOnFail: 100,
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
    });
  }

  async listForUser(
    userId: string,
    query: PaginationQuery,
  ): Promise<Paginated<NotificationDto>> {
    const [rows, total] = await this.repo.findPageByUser(
      userId,
      query.page,
      query.pageSize,
    );
    return {
      items: rows.map(toDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async unreadCount(userId: string): Promise<UnreadCountDto> {
    const user = await this.repo.findUnreadCount(userId);
    return { count: user?.unreadNotificationCount ?? 0 };
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const result = await this.repo.markReadIfUnread(userId, id, tx);
      if (result.count > 0) await this.repo.decrementUnread(userId, tx);
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.repo.markAllReadForUser(userId, tx);
      await this.repo.resetUnread(userId, tx);
    });
  }

  // ── scheduled (MaintenanceProcessor) ─────────────────────────────────────
  /** Nightly purge — read notifications after 90 days, unread after 1 year.
   *  Plain deletes for now; see Scale & retention for when this graduates to
   *  partition drops instead. */
  async pruneRead(): Promise<{ read: number; unread: number }> {
    const now = Date.now();
    const [read, unread] = await Promise.all([
      this.repo.deleteOldRead(new Date(now - 90 * 86_400_000)),
      this.repo.deleteOldUnread(new Date(now - 365 * 86_400_000)),
    ]);
    return { read: read.count, unread: unread.count };
  }

  /** Early-warning check ahead of the day the retention job's DELETE actually
   *  starts hurting — see Scale & retention. Debounced to once a week so it
   *  doesn't repeat every night once the threshold is crossed. */
  async checkTableSize(): Promise<void> {
    const alreadyWarned = await this.repo.hasRecentWarning(
      new Date(Date.now() - 7 * 86_400_000),
    );
    if (alreadyWarned) return;

    const rows = await this.repo.count();
    const THRESHOLD = 5_000_000;
    if (rows < THRESHOLD) return;

    const admins = await this.repo.findAdminUserIds();
    for (const admin of admins) {
      await this.notify({
        userId: admin.id,
        event: "TABLE_SIZE_WARNING",
        title: "Notification table is getting large",
        body: `The Notification table has reached ${rows.toLocaleString()} rows — time to plan the partitioning conversion (see NOTIFICATION_SYSTEM_PLAN.md).`,
      });
    }
  }
}
