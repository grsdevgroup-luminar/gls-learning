import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  updateOrderProviderRef(
    orderId: string,
    providerRef: string,
    providerRedirectUrl?: string,
  ) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        providerRef,
        // Cache the gateway URL so a replayed startPayment (client retry with
        // the same Idempotency-Key) can short-circuit and return the original
        // session URL instead of opening a second session at the provider.
        ...(providerRedirectUrl !== undefined ? { providerRedirectUrl } : {}),
      },
    });
  }

  createWebhookEvent(provider: string, eventId: string) {
    return this.prisma.webhookEvent.create({
      data: { provider, eventId, payload: {} as Prisma.InputJsonValue },
    });
  }

  markWebhookProcessed(provider: string, eventId: string) {
    return this.prisma.webhookEvent.updateMany({
      where: { provider, eventId },
      data: { processedAt: new Date() },
    });
  }
}
