import type { PaymentGateway as PaymentGatewayName } from "@prisma/client";
import type { OrderRow } from "../types";

export interface PaymentUrls {
  successUrl: string;
  cancelUrl: string;
}

export interface StartPaymentResult {
  redirectUrl?: string;
  providerRef?: string;
}

export interface WebhookInput {
  rawBody?: Buffer;
  body?: unknown;
  signature?: string;
}

export interface WebhookResult {
  eventId: string;
  orderId?: string;
  providerPaymentId?: string;
}

export interface PaymentGateway {
  readonly name: PaymentGatewayName;
  isConfigured(): boolean;
  startPayment(order: OrderRow, urls: PaymentUrls): Promise<StartPaymentResult>;
  refund(order: OrderRow): Promise<void>;
  verifyWebhook(input: WebhookInput): Promise<WebhookResult>;
}
