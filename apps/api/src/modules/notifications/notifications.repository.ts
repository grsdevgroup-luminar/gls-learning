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
}
