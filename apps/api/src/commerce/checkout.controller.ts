import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  checkoutQuoteSchema,
  checkoutSessionSchema,
  type CheckoutQuoteInput,
  type CheckoutSessionInput,
} from "@skillstream/shared";
import { CurrentUser, Public, type RequestUser } from "../common/decorators";
import { ZodBody } from "../common/swagger";
import { CheckoutService } from "./checkout.service";
import { CouponsService } from "./coupons.service";
import { OrdersService } from "./orders.service";

@ApiTags("checkout")
@ApiBearerAuth()
@Controller()
export class CheckoutController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly orders: OrdersService,
    private readonly coupons: CouponsService,
  ) {}

  /** Drives the site-wide promo banner — unauthenticated visitors see it too. */
  @Public()
  @Get("coupons/featured")
  featuredCoupon() {
    return this.coupons.featured();
  }

  @Post("checkout/quote")
  quote(
    @ZodBody(checkoutQuoteSchema) body: CheckoutQuoteInput,
  ) {
    return this.checkout.quote(body);
  }

  @Post("checkout/session")
  session(
    @CurrentUser() user: RequestUser,
    @ZodBody(checkoutSessionSchema)
    body: CheckoutSessionInput,
  ) {
    return this.checkout.createSession(user.id, body);
  }

  @Get("me/orders")
  myOrders(@CurrentUser() user: RequestUser) {
    return this.orders.myOrders(user.id);
  }
}
