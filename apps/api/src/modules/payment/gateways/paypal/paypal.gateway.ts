import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentGateway as PaymentGatewayName } from "@prisma/client";
import type { Env } from "../../../../config/env";
import type {
  PaymentGateway,
  PaymentUrls,
  StartPaymentResult,
  WebhookInput,
  WebhookResult,
} from "../../interfaces/payment-gateway.interface";
import type { OrderRow } from "../../types";

export type PaypalWebhookBody = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    custom_id?: string;
    purchase_units?: { custom_id?: string }[];
  };
};

@Injectable()
export class PaypalGateway implements PaymentGateway {
  readonly name = PaymentGatewayName.PAYPAL;

  constructor(private readonly config: ConfigService<Env, true>) {}

  isConfigured(): boolean {
    return (
      !!this.config.get("PAYPAL_CLIENT_ID", { infer: true }) &&
      !!this.config.get("PAYPAL_CLIENT_SECRET", { infer: true })
    );
  }

  private get isProd(): boolean {
    return this.config.get("NODE_ENV", { infer: true }) === "production";
  }

  /** Sandbox vs live host. Non-prod defaults to sandbox; prod must opt in. */
  private baseUrl(): string {
    const sandbox = this.config.get("PAYPAL_SANDBOX", { infer: true });
    const useSandbox = sandbox ?? !this.isProd;
    return useSandbox
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";
  }

  private async accessToken(): Promise<string> {
    const id = this.config.get("PAYPAL_CLIENT_ID", { infer: true });
    const secret = this.config.get("PAYPAL_CLIENT_SECRET", { infer: true });
    const basic = Buffer.from(`${id}:${secret}`).toString("base64");
    const res = await fetch(`${this.baseUrl()}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) {
      // Most often `invalid_client`: sandbox credentials pointed at the live
      // host (or vice versa). Surface it instead of returning an undefined
      // token that fails opaquely one request later.
      throw new ServiceUnavailableException(
        `PayPal auth failed (${res.status}): ${await res.text()}`,
      );
    }
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token)
      throw new ServiceUnavailableException("PayPal auth returned no token");
    return json.access_token;
  }

  async startPayment(
    order: OrderRow,
    urls: PaymentUrls,
  ): Promise<StartPaymentResult> {
    if (!this.isConfigured())
      throw new ServiceUnavailableException("PayPal is not configured");

    const token = await this.accessToken();
    const res = await fetch(`${this.baseUrl()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // PayPal returns the same order on retries with the same id, so a
        // duplicated request never opens a second checkout.
        "PayPal-Request-Id": `co_order_${order.id}`,
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
          return_url: urls.successUrl,
          cancel_url: urls.cancelUrl,
        },
      }),
    });
    if (!res.ok) {
      throw new ServiceUnavailableException(
        `PayPal order creation failed (${res.status}): ${await res.text()}`,
      );
    }
    const json = (await res.json()) as {
      id: string;
      links?: { rel: string; href: string }[];
    };
    const redirectUrl = json.links?.find((l) => l.rel === "approve")?.href;
    // Without an approve link there is nowhere to send the buyer. Failing here
    // keeps the caller from treating an unstarted payment as a started one.
    if (!redirectUrl)
      throw new ServiceUnavailableException(
        "PayPal returned no approval link",
      );
    return { providerRef: json.id, redirectUrl };
  }

  async refund(order: OrderRow): Promise<void> {
    if (!order.providerPaymentId || order.providerPaymentId === "dev_simulated")
      return;
    if (!this.isConfigured()) return;

    const token = await this.accessToken();
    const res = await fetch(
      `${this.baseUrl()}/v2/payments/captures/${order.providerPaymentId}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": `refund_${order.id}`,
        },
        body: "{}",
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      throw new BadRequestException(`PayPal refund failed: ${detail}`);
    }
  }

  async verifyWebhook(input: WebhookInput): Promise<WebhookResult> {
    const body = input.body as PaypalWebhookBody | undefined;
    const eventId = body?.id;
    const type = body?.event_type;
    if (!eventId || !type)
      throw new BadRequestException("Invalid PayPal event");

    const result: WebhookResult = { eventId };
    if (
      type === "CHECKOUT.ORDER.APPROVED" ||
      type === "PAYMENT.CAPTURE.COMPLETED"
    ) {
      result.orderId =
        body?.resource?.purchase_units?.[0]?.custom_id ??
        body?.resource?.custom_id;
      result.providerPaymentId = body?.resource?.id;
    }
    return result;
  }
}
