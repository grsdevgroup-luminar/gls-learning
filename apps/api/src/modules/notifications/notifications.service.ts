import { Injectable } from "@nestjs/common";
import type { Notification, NotificationEvent } from "@prisma/client";
import type {
  NotificationDto,
  Paginated,
  PaginationQuery,
  UnreadCountDto,
} from "@skillstream/shared";
import type { Db } from "../../common/types";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationFeedRepository } from "./notifications.repository";

export interface NotifyInput {
  userId: string;
  event: NotificationEvent;
  title: string;
  body: string;
  href?: string | null;
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
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly repo: NotificationFeedRepository,
    private readonly prisma: PrismaService,
  ) {}

  async notify(input: NotifyInput, tx?: Db): Promise<void> {
    await this.repo.create(input, tx);
    await this.repo.incrementUnread(input.userId, tx);
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
}
