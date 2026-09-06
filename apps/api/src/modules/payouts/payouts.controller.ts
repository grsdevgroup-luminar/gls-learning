import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  AdminPayoutQuerySchema,
  PayoutAccountSchema,
  QuotePayoutSchema,
  RejectPayoutSchema,
  RequestPayoutSchema,
  type AdminPayoutQuery,
  type PayoutAccountInput,
  type QuotePayoutInput,
  type RejectPayoutInput,
  type RequestPayoutInput,
} from "@skillstream/shared";
import { CurrentUser, Roles, type RequestUser } from "../../common/decorators/decorators";
import { ZodBody, ZodQuery } from "../../common/utils/swagger";
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

  // Stripe Connect Express — instructor onboarding + status polling.
  @Post("me/payout-account/stripe/onboard-link")
  stripeOnboardLink(@CurrentUser() user: RequestUser) {
    return this.payouts.createStripeOnboardLink(user);
  }

  @Get("me/payout-account/stripe/status")
  stripeStatus(@CurrentUser() user: RequestUser) {
    return this.payouts.getStripeStatus(user);
  }

  /** Live fee preview for the withdrawal modal. Pure read; no side effects. */
  @Post("me/payouts/quote")
  quote(
    @CurrentUser() user: RequestUser,
    @ZodBody(QuotePayoutSchema) body: QuotePayoutInput,
  ) {
    return this.payouts.quote(user, body.amountCents);
  }

  /** Body is optional — omitting `amountCents` drains the full available
   *  balance (backward-compatible with the pre-partial-payout clients). */
  @Post("me/payouts")
  request(
    @CurrentUser() user: RequestUser,
    @Body() rawBody?: unknown,
  ) {
    const body: RequestPayoutInput = rawBody
      ? RequestPayoutSchema.parse(rawBody)
      : {};
    return this.payouts.request(user, body);
  }

  // ── admin ──
  @Roles("ADMIN")
  @Get("admin/payouts")
  listAll(@ZodQuery(AdminPayoutQuerySchema) query: AdminPayoutQuery) {
    return this.payouts.listAll(query);
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
