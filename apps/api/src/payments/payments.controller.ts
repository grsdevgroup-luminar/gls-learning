import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { CurrentUser, Public, type RequestUser } from "../common/decorators";
import { PaymentsService } from "./payments.service";

@ApiTags("payments")
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Post("webhooks/stripe")
  @HttpCode(200)
  async stripe(@Req() req: RawBodyRequest<Request>): Promise<{ received: true }> {
    await this.payments.handleStripeWebhook(
      req.rawBody as Buffer,
      req.headers["stripe-signature"] as string | undefined,
    );
    return { received: true };
  }

  @Public()
  @Post("webhooks/paypal")
  @HttpCode(200)
  async paypal(@Body() body: unknown): Promise<{ received: true }> {
    await this.payments.handlePaypalWebhook(body);
    return { received: true };
  }

  /** Dev-only: simulate a successful payment to exercise fulfilment locally. */
  @Post("payments/dev/simulate/:orderId")
  @HttpCode(200)
  devSimulate(
    @CurrentUser() _user: RequestUser,
    @Param("orderId") orderId: string,
  ) {
    return this.payments.devSimulate(orderId);
  }
}
