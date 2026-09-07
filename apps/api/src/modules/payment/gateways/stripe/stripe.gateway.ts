import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentGateway as PaymentGatewayName } from "@prisma/client";
import Stripe from "stripe";
import type { Env } from "../../../../config/env";
import type {
  PaymentGateway,
  PendingPaymentResolution,
  PaymentUrls,
  StartPaymentResult,
  WebhookInput,
  WebhookResult,
} from "../../interfaces/payment-gateway.interface";
import type { OrderRow } from "../../types";

@Injectable()
export class StripeGateway implements PaymentGateway {
  readonly name = PaymentGatewayName.STRIPE;
  private readonly client: Stripe | null;

  constructor(private readonly config: ConfigService<Env, true>) {
    const key = this.config.get("STRIPE_SECRET_KEY", { infer: true });
    this.client = key ? new Stripe(key) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private requireClient(): Stripe {
    if (!this.client)
      throw new ServiceUnavailableException("Stripe is not configured");
    return this.client;
  }

  async startPayment(
    order: OrderRow,
    urls: PaymentUrls,
  ): Promise<StartPaymentResult> {
    const stripe = this.requireClient();
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        success_url: urls.successUrl,
        cancel_url: urls.cancelUrl,
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
      },
      // Stripe caches responses keyed by this value for 24h. Retries with the
      // same key return the exact same Checkout Session — no duplicate charge.
      { idempotencyKey: `co_session_${order.id}` },
    );
    return {
      redirectUrl: session.url ?? undefined,
      providerRef: session.id,
    };
  }

  /**
   * A student can leave Stripe without visiting our cancel URL, leaving the
   * local order PENDING. Before a retry creates a fresh checkout, reconcile
   * that old Stripe Session: never discard a completed payment, and expire an
   * unpaid session so it cannot be charged after its order is abandoned.
   */
  async reconcilePendingPayment(order: OrderRow): Promise<PendingPaymentResolution> {
    if (!order.providerRef || !this.client) return { status: "RESUME" };

    const resolutionFor = (session: Stripe.Checkout.Session): PendingPaymentResolution => {
      if (session.payment_status === "paid") {
        return {
          status: "PAID",
          providerPaymentId:
            typeof session.payment_intent === "string" ? session.payment_intent : undefined,
        };
      }
      if (session.status === "expired") return { status: "ABANDONED" };
      return { status: "RESUME" };
    };

    let session: Stripe.Checkout.Session;
    try {
      session = await this.client.checkout.sessions.retrieve(order.providerRef);
    } catch {
      // A temporary provider lookup failure must not turn a potentially paid
      // order into a failed one. Keep the existing session resumable instead.
      return { status: "RESUME" };
    }

    const initial = resolutionFor(session);
    if (initial.status !== "RESUME" || session.status !== "open") return initial;

    try {
      await this.client.checkout.sessions.expire(session.id);
      return { status: "ABANDONED" };
    } catch {
      // Completion can win the race with expiration. Re-read the session so a
      // successful payment is fulfilled rather than incorrectly abandoned.
      try {
        session = await this.client.checkout.sessions.retrieve(session.id);
        return resolutionFor(session);
      } catch {
        return { status: "RESUME" };
      }
    }
  }

  async refund(order: OrderRow): Promise<void> {
    if (!order.providerPaymentId || order.providerPaymentId === "dev_simulated")
      return;
    const stripe = this.requireClient();
    await stripe.refunds.create(
      { payment_intent: order.providerPaymentId },
      { idempotencyKey: `refund_${order.id}` },
    );
  }

  async verifyWebhook(input: WebhookInput): Promise<WebhookResult> {
    const stripe = this.requireClient();
    const secret = this.config.get("STRIPE_WEBHOOK_SECRET", { infer: true });
    if (!secret)
      throw new ServiceUnavailableException("Stripe webhooks not configured");
    if (!input.signature)
      throw new BadRequestException("Missing stripe signature");
    if (!input.rawBody)
      throw new BadRequestException("Missing raw webhook body");

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        input.rawBody,
        input.signature,
        secret,
      );
    } catch (err) {
      throw new BadRequestException(
        `Webhook signature verification failed: ${(err as Error).message}`,
      );
    }

    const result: WebhookResult = { eventId: event.id };
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      result.orderId =
        session.metadata?.orderId ?? session.client_reference_id ?? undefined;
      result.providerPaymentId =
        (session.payment_intent as string | null) ?? undefined;
    }
    return result;
  }
}
