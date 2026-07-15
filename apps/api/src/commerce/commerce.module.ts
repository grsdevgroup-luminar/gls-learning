import { Module } from "@nestjs/common";
import { EnrollmentModule } from "../enrollment/enrollment.module";
import { SalesAgentModule } from "../sales-agent/sales-agent.module";
import { PaymentsService } from "../payments/payments.service";
import { PaymentsController } from "../payments/payments.controller";
import { PricingService } from "./pricing.service";
import { PricingController } from "./pricing.controller";
import { CouponsService } from "./coupons.service";
import { OrdersService } from "./orders.service";
import { CheckoutService } from "./checkout.service";
import { CheckoutController } from "./checkout.controller";

// Single module for the whole commerce surface (pricing, coupons, checkout,
// orders, payments) to keep the order ↔ payment relationship free of circular
// module dependencies.
@Module({
  imports: [EnrollmentModule, SalesAgentModule],
  controllers: [CheckoutController, PricingController, PaymentsController],
  providers: [
    PricingService,
    CouponsService,
    OrdersService,
    CheckoutService,
    PaymentsService,
  ],
  exports: [PricingService, CouponsService, OrdersService],
})
export class CommerceModule {}
