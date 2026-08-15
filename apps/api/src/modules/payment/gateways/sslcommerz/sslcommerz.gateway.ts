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

/** Session-init response (relevant fields). */
interface SslcSessionResponse {
  status: string;
  failedreason?: string;
  sessionkey?: string;
  GatewayPageURL?: string;
}

/** Validation API response (relevant fields). */
interface SslcValidationResponse {
  status?: string;
  tran_id?: string;
  val_id?: string;
  bank_tran_id?: string;
  amount?: string;
  currency?: string;
}

/**
 * IPN body: SSLCommerz POSTs form-encoded fields to our callback URLs. The
 * flow is: user redirected to GatewayPageURL → they pay → SSLCommerz POSTs
 * IPN back to us with `val_id` → we call the validation API server-side to
 * confirm the transaction status is `VALID` / `VALIDATED` before fulfilling
 * the order. Never trust the IPN body on its own.
 */
export interface SslcIpnBody {
  tran_id?: string;
  val_id?: string;
  status?: string;
  amount?: string;
  currency?: string;
  bank_tran_id?: string;
}

@Injectable()
export class SslcommerzGateway implements PaymentGateway {
  readonly name = PaymentGatewayName.SSLCOMMERZ;

  constructor(private readonly config: ConfigService<Env, true>) {}

  isConfigured(): boolean {
    return (
      !!this.config.get("SSLCOMMERZ_STORE_ID", { infer: true }) &&
      !!this.config.get("SSLCOMMERZ_STORE_PASSWD", { infer: true })
    );
  }

  private get isProd(): boolean {
    return this.config.get("NODE_ENV", { infer: true }) === "production";
  }

  /** Sandbox vs live host. Non-prod defaults to sandbox; prod must opt out. */
  private baseUrl(): string {
    const sandbox = this.config.get("SSLCOMMERZ_SANDBOX", { infer: true });
    const useSandbox = sandbox ?? !this.isProd;
    return useSandbox
      ? "https://sandbox.sslcommerz.com"
      : "https://securepay.sslcommerz.com";
  }

  private storeCreds() {
    const store_id = this.config.get("SSLCOMMERZ_STORE_ID", { infer: true });
    const store_passwd = this.config.get("SSLCOMMERZ_STORE_PASSWD", {
      infer: true,
    });
    if (!store_id || !store_passwd)
      throw new ServiceUnavailableException("SSLCommerz is not configured");
    return { store_id, store_passwd };
  }

  async startPayment(
    order: OrderRow,
    urls: PaymentUrls,
  ): Promise<StartPaymentResult> {
    const { store_id, store_passwd } = this.storeCreds();

    const params = new URLSearchParams();
    params.set("store_id", store_id);
    params.set("store_passwd", store_passwd);
    params.set("total_amount", (order.totalCents / 100).toFixed(2));
    params.set("currency", order.currency);
    params.set("tran_id", order.id);
    params.set("success_url", urls.successUrl);
    params.set("fail_url", urls.cancelUrl);
    params.set("cancel_url", urls.cancelUrl);
    // IPN endpoint — must be publicly reachable.
    params.set(
      "ipn_url",
      `${this.config.get("PUBLIC_API_URL", { infer: true }) ?? ""}/webhooks/sslcommerz`,
    );
    // Product / customer fields are required by their schema; snapshot enough
    // to satisfy the validator without leaking anything sensitive.
    params.set("product_name", order.items[0]?.titleSnapshot ?? "Course");
    params.set("product_category", "course");
    params.set("product_profile", "general");
    params.set("cus_name", "Learner");
    params.set("cus_email", "learner@example.com");
    params.set("cus_phone", "0000000000");
    params.set("cus_add1", "N/A");
    params.set("cus_city", "N/A");
    params.set("cus_country", "N/A");
    params.set("shipping_method", "NO");
    params.set("num_of_item", String(order.items.length));

    const res = await fetch(
      `${this.baseUrl()}/gwprocess/v4/api.php`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      },
    );
    const json = (await res.json()) as SslcSessionResponse;
    if (json.status !== "SUCCESS" || !json.GatewayPageURL) {
      throw new BadRequestException(
        `SSLCommerz session init failed: ${json.failedreason ?? json.status}`,
      );
    }
    return {
      redirectUrl: json.GatewayPageURL,
      providerRef: json.sessionkey,
    };
  }

  async refund(order: OrderRow): Promise<void> {
    if (!order.providerPaymentId || order.providerPaymentId === "dev_simulated")
      return;
    const { store_id, store_passwd } = this.storeCreds();

    const params = new URLSearchParams();
    params.set("bank_tran_id", order.providerPaymentId);
    params.set("refund_amount", (order.totalCents / 100).toFixed(2));
    params.set("refund_remarks", `Order ${order.id}`);
    params.set("refe_id", order.id);
    params.set("store_id", store_id);
    params.set("store_passwd", store_passwd);

    const res = await fetch(
      `${this.baseUrl()}/validator/api/merchantTransIDvalidationAPI.php?${params.toString()}`,
      { method: "GET" },
    );
    if (!res.ok) {
      throw new BadRequestException(
        `SSLCommerz refund failed: ${await res.text()}`,
      );
    }
  }

  /**
   * IPN verification. SSLCommerz's IPN body is forgeable — the required step
   * is calling their validator API with the `val_id` and confirming
   * `status === "VALID" | "VALIDATED"`. Only then can we treat the order as
   * paid.
   */
  async verifyWebhook(input: WebhookInput): Promise<WebhookResult> {
    const body = input.body as SslcIpnBody | undefined;
    const valId = body?.val_id;
    const tranId = body?.tran_id;
    if (!valId || !tranId)
      throw new BadRequestException("Invalid SSLCommerz IPN");

    const { store_id, store_passwd } = this.storeCreds();
    const url = new URL(
      "/validator/api/validationserverAPI.php",
      this.baseUrl(),
    );
    url.searchParams.set("val_id", valId);
    url.searchParams.set("store_id", store_id);
    url.searchParams.set("store_passwd", store_passwd);
    url.searchParams.set("format", "json");

    const res = await fetch(url.toString());
    const json = (await res.json()) as SslcValidationResponse;

    const result: WebhookResult = { eventId: valId };
    if (json.status === "VALID" || json.status === "VALIDATED") {
      result.orderId = json.tran_id ?? tranId;
      result.providerPaymentId = json.bank_tran_id ?? valId;
    }
    return result;
  }
}
