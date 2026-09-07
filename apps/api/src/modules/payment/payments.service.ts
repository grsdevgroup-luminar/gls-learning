import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentGateway as PaymentGatewayName } from "@prisma/client";
import type { CheckoutSessionDto } from "@skillstream/shared";
import type { Env } from "../../config/env";
import { OrdersService } from "../commerce/orders.service";
import { PaymentGatewayFactory } from "./factory/payment-gateway.factory";
import type {
  PendingPaymentResolution,
  WebhookInput,
} from "./interfaces/payment-gateway.interface";
import { PaymentsRepository } from "./payments.repository";
import type { OrderRow } from "./types";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly repo: PaymentsRepository,
    private readonly orders: OrdersService,
    private readonly factory: PaymentGatewayFactory,
  ) {}

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
    gateway: PaymentGatewayName,
  ): Promise<CheckoutSessionDto> {
    const impl = this.factory.getGateway(gateway.toLowerCase());

    const devSimulateToken = this.isProd ? undefined : order.id;

    if (!impl.isConfigured()) {
      if (this.isProd)
        throw new ServiceUnavailableException(
          `${gateway} is not configured on this server`,
        );
      return { orderId: order.id, gateway, devSimulateToken };
    }

    // Replay short-circuit: a prior successful startPayment for this order
    // already cached the gateway URL. Return it unchanged so the client can
    // resume the exact same provider session (Stripe/PayPal/SSLCommerz).
    if (order.providerRedirectUrl && order.providerRef) {
      return {
        orderId: order.id,
        gateway,
        redirectUrl: order.providerRedirectUrl,
        providerRef: order.providerRef,
        devSimulateToken,
      };
    }

    const { redirectUrl, providerRef } = await impl.startPayment(order, {
      successUrl: this.successUrl(order.id),
      cancelUrl: this.cancelUrl(order.id),
    });

    // Cache providerRef alongside redirectUrl so a subsequent replay hits the
    // short-circuit above instead of opening a second provider session.
    if (providerRef)
      await this.repo.updateOrderProviderRef(order.id, providerRef, redirectUrl);

    return {
      orderId: order.id,
      gateway,
      redirectUrl,
      providerRef,
      devSimulateToken,
    };
  }

  /** Inspect a pending provider session before replacing it on a retry. */
  async reconcilePendingPayment(order: OrderRow): Promise<PendingPaymentResolution> {
    const gateway = this.factory.getGateway(order.gateway.toLowerCase());
    return gateway.reconcilePendingPayment?.(order) ?? { status: "RESUME" };
  }

  async refundGatewayPayment(order: OrderRow): Promise<void> {
    await this.factory.getGateway(order.gateway.toLowerCase()).refund(order);
  }

  async handleStripeWebhook(
    rawBody: Buffer,
    signature?: string,
  ): Promise<void> {
    await this.processWebhook(PaymentGatewayName.STRIPE, {
      rawBody,
      signature,
    });
  }

  async handlePaypalWebhook(body: unknown): Promise<void> {
    await this.processWebhook(PaymentGatewayName.PAYPAL, { body });
  }

  async handleSslcommerzWebhook(body: unknown): Promise<void> {
    await this.processWebhook(PaymentGatewayName.SSLCOMMERZ, { body });
  }

  private async processWebhook(
    gateway: PaymentGatewayName,
    input: WebhookInput,
  ): Promise<void> {
    const provider = gateway.toLowerCase();
    const impl = this.factory.getGateway(provider);
    const result = await impl.verifyWebhook(input);

    if (!(await this.recordOnce(provider, result.eventId))) return;

    if (result.orderId)
      await this.orders.fulfill(result.orderId, result.providerPaymentId);

    await this.repo.markWebhookProcessed(provider, result.eventId);
  }

  async devSimulate(orderId: string) {
    if (this.isProd)
      throw new BadRequestException("Not available in production");
    return this.orders.fulfill(orderId, "dev_simulated");
  }

  private async recordOnce(
    provider: string,
    eventId: string,
  ): Promise<boolean> {
    try {
      await this.repo.createWebhookEvent(provider, eventId);
      return true;
    } catch {
      return false;
    }
  }
}
