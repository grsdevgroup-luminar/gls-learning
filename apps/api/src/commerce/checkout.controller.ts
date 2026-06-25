import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  checkoutQuoteSchema,
  checkoutSessionSchema,
  type CheckoutQuoteInput,
  type CheckoutSessionInput,
} from "@skillstream/shared";
import { CurrentUser, type RequestUser } from "../common/decorators";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CheckoutService } from "./checkout.service";
import { OrdersService } from "./orders.service";

@ApiTags("checkout")
@ApiBearerAuth()
@Controller()
export class CheckoutController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly orders: OrdersService,
  ) {}

  @Post("checkout/quote")
  quote(
    @Body(new ZodValidationPipe(checkoutQuoteSchema)) body: CheckoutQuoteInput,
  ) {
    return this.checkout.quote(body);
  }

  @Post("checkout/session")
  session(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(checkoutSessionSchema))
    body: CheckoutSessionInput,
  ) {
    return this.checkout.createSession(user.id, body);
  }

  @Get("me/orders")
  myOrders(@CurrentUser() user: RequestUser) {
    return this.orders.myOrders(user.id);
  }
}
