import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PayoutStatus } from "@prisma/client";
import {
  PayoutAccountSchema,
  RejectPayoutSchema,
  type PayoutAccountInput,
  type RejectPayoutInput,
} from "@skillstream/shared";
import { CurrentUser, Roles, type RequestUser } from "../../common/decorators/decorators";
import { ZodBody } from "../../common/utils/swagger";
import { PayoutsService } from "./payouts.service";

@ApiTags("payouts")
@ApiBearerAuth()
@Controller()
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  // ── payee (instructor / sales agent) ──
  @Get("me/payouts/balance")
  balance(@CurrentUser() user: RequestUser) {
    return this.payouts.myBalance(user);
  }

  @Get("me/payouts")
  mine(@CurrentUser() user: RequestUser) {
    return this.payouts.myPayouts(user);
  }

  @Get("me/payout-account")
  account(@CurrentUser() user: RequestUser) {
    return this.payouts.myAccount(user);
  }

  @Post("me/payout-account")
  setAccount(
    @CurrentUser() user: RequestUser,
    @ZodBody(PayoutAccountSchema) body: PayoutAccountInput,
  ) {
    return this.payouts.setAccount(user, body);
  }

  @Post("me/payouts")
  request(@CurrentUser() user: RequestUser) {
    return this.payouts.request(user);
  }

  // ── admin ──
  @Roles("ADMIN")
  @Get("admin/payouts")
  listAll(@Query("status") status?: PayoutStatus) {
    return this.payouts.listAll(status);
  }

  @Roles("ADMIN")
  @Post("admin/payouts/:id/approve")
  approve(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.payouts.approve(user, id);
  }

  @Roles("ADMIN")
  @Post("admin/payouts/:id/mark-paid")
  markPaid(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.payouts.markPaid(user, id);
  }

  @Roles("ADMIN")
  @Post("admin/payouts/:id/reject")
  reject(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @ZodBody(RejectPayoutSchema) body: RejectPayoutInput,
  ) {
    return this.payouts.reject(user, id, body.note);
  }
}
