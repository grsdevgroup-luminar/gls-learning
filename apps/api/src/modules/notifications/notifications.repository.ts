import { Injectable } from "@nestjs/common";
import type { NotificationEvent } from "@prisma/client";
import type { Db } from "../../common/types";
import { PrismaService } from "../../prisma/prisma.service";

export interface CreateNotificationInput {
  userId: string;
  event: NotificationEvent;
  title: string;
  body: string;
  href?: string | null;
}

@Injectable()
export class NotificationFeedRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db) {
    return tx ?? this.prisma;
  }

  create(data: CreateNotificationInput, tx?: Db) {
    return this.db(tx).notification.create({ data });
  }

  incrementUnread(userId: string, tx?: Db) {
    return this.db(tx).user.update({
      where: { id: userId },
      data: { unreadNotificationCount: { increment: 1 } },
    });
  }

  findUnreadCount(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { unreadNotificationCount: true },
    });
  }

  findPageByUser(userId: string, page: number, pageSize: number) {
    return this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
  }

  /** Only flips `readAt` if it was still unread — lets the caller know whether
   *  to decrement the denormalized counter (a repeat mark-read is a no-op). */
  markReadIfUnread(userId: string, id: string, tx?: Db) {
    return this.db(tx).notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  decrementUnread(userId: string, tx?: Db) {
    return this.db(tx).user.update({
      where: { id: userId },
      data: { unreadNotificationCount: { decrement: 1 } },
    });
  }

  markAllReadForUser(userId: string, tx?: Db) {
    return this.db(tx).notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  resetUnread(userId: string, tx?: Db) {
    return this.db(tx).user.update({
      where: { id: userId },
      data: { unreadNotificationCount: 0 },
    });
  }

  // ── retention & scale monitoring ────────────────────────────────────────
  /** Read notifications past the retention window — see Scale & retention in
   *  NOTIFICATION_SYSTEM_PLAN.md (90d). Unread ones are handled separately
   *  since they get a longer grace period (1y). */
  deleteOldRead(cutoff: Date) {
    return this.prisma.notification.deleteMany({
      where: { readAt: { not: null, lt: cutoff } },
    });
  }

  deleteOldUnread(cutoff: Date) {
    return this.prisma.notification.deleteMany({
      where: { readAt: null, createdAt: { lt: cutoff } },
    });
  }

  count() {
    return this.prisma.notification.count();
  }

  /** Debounce for the table-size warning — checked once, globally, rather
   *  than per-admin, so admins don't get out of sync with each other. */
  hasRecentWarning(since: Date) {
    return this.prisma.notification.findFirst({
      where: { event: "TABLE_SIZE_WARNING", createdAt: { gte: since } },
      select: { id: true },
    });
  }

  findAdminUserIds(tx?: Db) {
    return this.db(tx).user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });
  }
}
