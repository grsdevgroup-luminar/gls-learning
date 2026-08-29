import { Global, Module } from "@nestjs/common";
import { CreditsController } from "./credits.controller";
import { CreditsRepository } from "./credits.repository";
import { CreditsService } from "./credits.service";

/**
 * Global — refund flow (AdminService) and checkout flow (CheckoutService) both
 * need to write to the ledger, and the student profile endpoint reads balances.
 * A shared, always-available provider avoids re-importing the module in every
 * consumer, matching the NotificationsModule pattern.
 */
@Global()
@Module({
  controllers: [CreditsController],
  providers: [CreditsService, CreditsRepository],
  exports: [CreditsService],
})
export class CreditsModule {}
