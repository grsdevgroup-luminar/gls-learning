import {
  Controller,
  Get,
  Header,
  Headers,
  Logger,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import {
  checkoutQuoteSchema,
  checkoutSessionSchema,
  searchQuerySchema,
  type CheckoutQuoteInput,
  type CheckoutSessionInput,
  type SearchQuery,
} from "@skillstream/shared";
import { CurrentUser, Public, type RequestUser } from "../../common/decorators/decorators";
import { ZodBody, ZodQuery } from "../../common/utils/swagger";
import { clientIp } from "../../common/utils/client-ip";
import { CheckoutService } from "./checkout.service";
import { CouponsService } from "./coupons.service";
import { OrdersService } from "./orders.service";

const REDACT_HEADERS = new Set([
  "cookie",
  "authorization",
  "proxy-authorization",
  "set-cookie",
]);

function formatRequestHeaders(req: Request): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(req.headers)) {
    if (REDACT_HEADERS.has(name.toLowerCase())) {
      parts.push(`${name}=<redacted>`);
      continue;
    }
    const text = Array.isArray(value) ? value.join(" | ") : (value ?? "");
    parts.push(`${name}=${text}`);
  }
  return parts.join(" ");
}

@ApiTags("checkout")
@ApiBearerAuth()
@Controller()
export class CheckoutController {
  private readonly logger = new Logger(CheckoutController.name);

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

  /** Pure price calculation (course IDs + region + coupon, no user data) — the
   *  checkout page shows real pricing to anonymous visitors by design; only
   *  "Pay" itself requires login (`FEATURE_FLOWS.md` §2.4). */
  @Public()
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
    @Req() req: Request,
    // Optional during rollout; the web client sends it, but legacy clients
    // still work without. Format is validated inside the service.
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    this.logger.log(
      `Checkout session headers resolvedIp=${clientIp(req)} req.ip=${req.ip ?? "null"} socket=${req.socket?.remoteAddress ?? "null"} ${formatRequestHeaders(req)}`,
    );
    return this.checkout.createSession(user.id, body, clientIp(req), idempotencyKey);
  }

  @Get("me/orders")
  myOrders(
    @CurrentUser() user: RequestUser,
    @ZodQuery(searchQuerySchema) query: SearchQuery,
  ) {
    return this.orders.myOrders(user.id, query);
  }

  /** Aggregate spend/paid-count for the caller — drives the billing sidebar. */
  @Get("me/orders/stats")
  myOrderStats(@CurrentUser() user: RequestUser) {
    return this.orders.myOrderStats(user.id);
  }

  /** Receipt for one of the caller's own paid orders. */
  @Get("me/orders/:id/receipt")
  @Header("Content-Type", "application/pdf")
  @ApiProduces("application/pdf")
  @ApiOperation({
    summary: "Download a receipt PDF for one of your orders",
    description: "404 for orders belonging to another account; 400 for unpaid orders.",
  })
  async receipt(
    @CurrentUser() user: RequestUser,
    @Param("id") orderId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const pdf = await this.orders.receiptPdf(user.id, orderId);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="skillstream-receipt-${orderId}.pdf"`,
    );
    return new StreamableFile(pdf);
  }
}
