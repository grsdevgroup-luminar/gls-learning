import { BullModule } from "@nestjs/bullmq";
import { Global, Module } from "@nestjs/common";
import { NOTIFICATIONS_QUEUE } from "../jobs/jobs.constants";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { NotificationFeedRepository } from "./notifications.repository";
import { NotificationPreferencesService } from "./notification-preferences.service";
import { NotificationPreferencesRepository } from "./notification-preferences.repository";

// Global, matching EmailModule's convention: nearly every feature module (orders,
// instructor, delivery-partner, payouts, enrollment, ...) needs to write a
// notification as a side effect of its own state changes.
//
// registerQueue(NOTIFICATIONS_QUEUE) here (alongside the identical registration
// in JobsModule) is the standard BullMQ pattern for a queue with producers in
// more than one module — both bind to the same named Redis-backed queue, and
// JobsModule's NotificationsProcessor stays the single consumer either way.
@Global()
@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationFeedRepository,
    NotificationPreferencesService,
    NotificationPreferencesRepository,
  ],
  exports: [NotificationsService, NotificationPreferencesService],
})
export class NotificationsModule {}
