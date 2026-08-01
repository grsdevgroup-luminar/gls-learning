import { Module } from "@nestjs/common";
import { EnrollmentModule } from "../enrollment/enrollment.module";
import { SalesAgentModule } from "../sales-agent/sales-agent.module";
import { PaymentsService } from "../payments/payments.service";
import { PaymentsController } from "../payments/payments.controller";
import { PaymentsRepository } from "../payments/payments.repository";
import { PricingService } from "./pricing.service";
import { PricingController } from "./pricing.controller";
import { PricingRepository } from "./pricing.repository";
import { AdminPricingService } from "./admin-pricing.service";
import { AdminPricingController } from "./admin-pricing.controller";
import { CouponsService } from "./coupons.service";
import { CouponsRepository } from "./coupons.repository";
import { OrdersService } from "./orders.service";
import { OrdersRepository } from "./orders.repository";
import { CheckoutService } from "./checkout.service";
import { CheckoutController } from "./checkout.controller";

// Single module for the whole commerce surface (pricing, coupons, checkout,
// orders, payments) to keep the order ↔ payment relationship free of circular
// module dependencies.
@Module({
  imports: [EnrollmentModule, SalesAgentModule],
  controllers: [
    CheckoutController,
    PricingController,
    AdminPricingController,
    PaymentsController,
  ],
  providers: [
    PricingService,
    PricingRepository,
    AdminPricingService,
    CouponsService,
    CouponsRepository,
    OrdersService,
    OrdersRepository,
    CheckoutService,
    PaymentsService,
    PaymentsRepository,
  ],
  exports: [PricingService, CouponsService, OrdersService, PaymentsService],
})
export class CommerceModule {}
