import { Global, Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { NotificationFeedRepository } from "./notifications.repository";

// Global, matching EmailModule's convention: nearly every feature module (orders,
// instructor, sales-agent, payouts, enrollment, ...) needs to write a
// notification as a side effect of its own state changes.
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationFeedRepository],
  exports: [NotificationsService],
})
export class NotificationsModule {}
