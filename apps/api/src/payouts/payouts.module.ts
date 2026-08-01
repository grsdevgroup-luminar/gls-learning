import { Module } from "@nestjs/common";
import { PayoutsController } from "./payouts.controller";
import { PayoutsService } from "./payouts.service";
import { PayoutsRepository } from "./payouts.repository";

@Module({
  controllers: [PayoutsController],
  providers: [PayoutsService, PayoutsRepository],
})
export class PayoutsModule {}
