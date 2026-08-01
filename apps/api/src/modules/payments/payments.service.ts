import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentGateway } from "@prisma/client";
import Stripe from "stripe";
import type { CheckoutSessionDto } from "@skillstream/shared";
import { OrdersService } from "../commerce/orders.service";
import type { Env } from "../../config/env";
import { PaymentsRepository } from "./payments.repository";

type OrderRow = NonNullable<Awaited<ReturnType<OrdersService["findById"]>>>;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: Stripe | null = null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly repo: PaymentsRepository,
    private readonly orders: OrdersService,
  ) {
    const key = this.config.get("STRIPE_SECRET_KEY", { infer: true });
    if (key) this.stripe = new Stripe(key);
  }

  private get isProd(): boolean {
    return this.config.get("NODE_ENV", { infer: true }) === "production";
  }

  private get webOrigin(): string {
    return this.config.get("WEB_ORIGIN", { infer: true });
  }

  successUrl(orderId: string): string {
    return `${this.webOrigin}/checkout/success?order=${orderId}`;
  }
  cancelUrl(orderId: string): string {
    return `${this.webOrigin}/cart?canceled=${orderId}`;
  }

  async startPayment(
    order: OrderRow,
    gateway: PaymentGateway,
  ): Promise<CheckoutSessionDto> {
    // In non-production, always offer a simulate token so the flow is testable
    // without live payment credentials.
    const devSimulateToken = this.isProd ? undefined : order.id;

    if (gateway === "STRIPE" && this.stripe) {
      const session = await this.stripe.checkout.sessions.create({
        mode: "payment",
        success_url: this.successUrl(order.id),
        cancel_url: this.cancelUrl(order.id),
        client_reference_id: order.id,
        metadata: { orderId: order.id },
        line_items: order.items.map((i) => ({
          quantity: 1,
          price_data: {
            currency: order.currency.toLowerCase(),
            unit_amount: i.priceCents,
            product_data: { name: i.titleSnapshot },
          },
        })),
      });
      await this.repo.updateOrderProviderRef(order.id, session.id);
      return {
        orderId: order.id,
        gateway,
        redirectUrl: session.url ?? undefined,
        providerRef: session.id,
        devSimulateToken,
      };
    }

    if (gateway === "PAYPAL" && this.paypalConfigured()) {
      const pp = await this.createPaypalOrder(order);
      return {
        orderId: order.id,
        gateway,
        redirectUrl: pp.approveUrl,
        providerRef: pp.id,
        devSimulateToken,
      };
    }

    // No live credentials for the chosen gateway.
    if (this.isProd)
      throw new ServiceUnavailableException(
        `${gateway} is not configured on this server`,
      );
    return { orderId: order.id, gateway, devSimulateToken };
  }

  // ── Stripe webhook ──────────────────────────────────────────────────────
  async handleStripeWebhook(rawBody: Buffer, signature?: string): Promise<void> {
    const secret = this.config.get("STRIPE_WEBHOOK_SECRET", { infer: true });
    if (!this.stripe || !secret)
      throw new ServiceUnavailableException("Stripe webhooks not configured");
    if (!signature) throw new BadRequestException("Missing stripe signature");

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      throw new BadRequestException(
        `Webhook signature verification failed: ${(err as Error).message}`,
      );
    }

    if (!(await this.recordOnce("stripe", event.id))) return; // already processed

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId ?? session.client_reference_id;
      if (orderId)
        await this.orders.fulfill(orderId, session.payment_intent as string);
    }
    await this.markProcessed("stripe", event.id);
  }

  // ── PayPal (REST) ───────────────────────────────────────────────────────
  private paypalConfigured(): boolean {
    return (
      !!this.config.get("PAYPAL_CLIENT_ID", { infer: true }) &&
      !!this.config.get("PAYPAL_CLIENT_SECRET", { infer: true })
    );
  }

  private paypalBase(): string {
    return this.isProd
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
  }

  private async paypalAccessToken(): Promise<string> {
    const id = this.config.get("PAYPAL_CLIENT_ID", { infer: true });
    const secret = this.config.get("PAYPAL_CLIENT_SECRET", { infer: true });
    const res = await fetch(`${this.paypalBase()}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const json = (await res.json()) as { access_token: string };
    return json.access_token;
  }

  private async createPaypalOrder(
    order: OrderRow,
  ): Promise<{ id: string; approveUrl?: string }> {
    const token = await this.paypalAccessToken();
    const res = await fetch(`${this.paypalBase()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            custom_id: order.id,
            amount: {
              currency_code: order.currency,
              value: (order.totalCents / 100).toFixed(2),
            },
          },
        ],
        application_context: {
          return_url: this.successUrl(order.id),
          cancel_url: this.cancelUrl(order.id),
        },
      }),
    });
    const json = (await res.json()) as {
      id: string;
      links?: { rel: string; href: string }[];
    };
    await this.repo.updateOrderProviderRef(order.id, json.id);
    return {
      id: json.id,
      approveUrl: json.links?.find((l) => l.rel === "approve")?.href,
    };
  }

  async handlePaypalWebhook(body: any): Promise<void> {
    const eventId: string | undefined = body?.id;
    const type: string | undefined = body?.event_type;
    if (!eventId || !type) throw new BadRequestException("Invalid PayPal event");
    if (!(await this.recordOnce("paypal", eventId))) return;

    if (
      type === "CHECKOUT.ORDER.APPROVED" ||
      type === "PAYMENT.CAPTURE.COMPLETED"
    ) {
      const orderId: string | undefined =
        body?.resource?.purchase_units?.[0]?.custom_id ??
        body?.resource?.custom_id;
      if (orderId) await this.orders.fulfill(orderId, body?.resource?.id);
    }
    await this.markProcessed("paypal", eventId);
  }

  // ── Refunds ──────────────────────────────────────────────────────────────
  /** Refunds the payment at the gateway. No-op (dev-simulated orders, or a
   * gateway with no captured payment) is treated as success — the caller
   * still records the refund in our own ledger. */
  async refundGatewayPayment(order: OrderRow): Promise<void> {
    if (!order.providerPaymentId || order.providerPaymentId === "dev_simulated")
      return;

    if (order.gateway === "STRIPE" && this.stripe) {
      await this.stripe.refunds.create({
        payment_intent: order.providerPaymentId,
      });
      return;
    }

    if (order.gateway === "PAYPAL" && this.paypalConfigured()) {
      const token = await this.paypalAccessToken();
      const res = await fetch(
        `${this.paypalBase()}/v2/payments/captures/${order.providerPaymentId}/refund`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      );
      if (!res.ok) {
        const detail = await res.text();
        throw new BadRequestException(`PayPal refund failed: ${detail}`);
      }
    }
  }

  // ── Dev simulate (non-production only) ──────────────────────────────────
  async devSimulate(orderId: string) {
    if (this.isProd) throw new BadRequestException("Not available in production");
    return this.orders.fulfill(orderId, "dev_simulated");
  }

  // ── Webhook idempotency ─────────────────────────────────────────────────
  /** Returns true if this event should be processed (first time seen). */
  private async recordOnce(provider: string, eventId: string): Promise<boolean> {
    try {
      await this.repo.createWebhookEvent(provider, eventId);
      return true;
    } catch {
      return false; // unique(provider,eventId) violated -> already seen
    }
  }

  private async markProcessed(provider: string, eventId: string): Promise<void> {
    await this.repo.markWebhookProcessed(provider, eventId);
  }
}
