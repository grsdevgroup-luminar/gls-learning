import { Module } from "@nestjs/common";
import { EnrollmentModule } from "../enrollment/enrollment.module";
import { SalesAgentModule } from "../sales-agent/sales-agent.module";
import { UsersModule } from "../users/users.module";
import { GeoIpModule } from "../geoip/geoip.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsService } from "../payment/payments.service";
import { PaymentsController } from "../payment/payments.controller";
import { PaymentsRepository } from "../payment/payments.repository";
import { PaymentGatewayFactory } from "../payment/factory/payment-gateway.factory";
import { StripeGateway } from "../payment/gateways/stripe/stripe.gateway";
import { PaypalGateway } from "../payment/gateways/paypal/paypal.gateway";
import { SslcommerzGateway } from "../payment/gateways/sslcommerz/sslcommerz.gateway";
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
import { CartService } from "./cart.service";
import { CartController } from "./cart.controller";
import { CartRepository } from "./cart.repository";

// Single module for the whole commerce surface (pricing, coupons, checkout,
// orders, payments) to keep the order ↔ payment relationship free of circular
// module dependencies.
@Module({
  imports: [
    EnrollmentModule,
    SalesAgentModule,
    UsersModule,
    GeoIpModule,
    NotificationsModule,
  ],
  controllers: [
    CheckoutController,
    PricingController,
    AdminPricingController,
    PaymentsController,
    CartController,
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
    StripeGateway,
    PaypalGateway,
    SslcommerzGateway,
    PaymentGatewayFactory,
    CartService,
    CartRepository,
  ],
  exports: [
    PricingService,
    CouponsService,
    OrdersService,
    PaymentsService,
    CartService,
  ],
})
export class CommerceModule {}
