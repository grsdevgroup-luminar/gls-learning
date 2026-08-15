import { Injectable } from '@nestjs/common';
import { PaymentGateway } from '../interfaces/payment-gateway.interface';
import { StripeGateway } from '../gateways/stripe/stripe.gateway';
import { PaypalGateway } from '../gateways/paypal/paypal.gateway';
import { SslcommerzGateway } from '../gateways/sslcommerz/sslcommerz.gateway';

@Injectable()
export class PaymentGatewayFactory {

  constructor(
    private readonly stripeGateway: StripeGateway,
    private readonly paypalGateway: PaypalGateway,
    private readonly sslcommerzGateway: SslcommerzGateway,
  ) {}

  getGateway(provider: string): PaymentGateway {

    switch (provider) {
      case 'stripe':
        return this.stripeGateway;

      case 'paypal':
        return this.paypalGateway;

      case 'sslcommerz':
        return this.sslcommerzGateway;

      default:
        throw new Error(
          `Unsupported payment provider: ${provider}`,
        );
    }
  }
}
