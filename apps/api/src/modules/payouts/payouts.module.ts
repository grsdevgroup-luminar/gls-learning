import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { PayoutsController } from "./payouts.controller";
import { PayoutsService } from "./payouts.service";
import { PayoutsRepository } from "./payouts.repository";
import { StripePayoutService } from "./stripe-payout.service";

@Module({
  imports: [NotificationsModule],
  controllers: [PayoutsController],
  providers: [PayoutsService, PayoutsRepository, StripePayoutService],
})
export class PayoutsModule {}
