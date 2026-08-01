import { Injectable } from "@nestjs/common";
import { Payout, PayoutStatus, Prisma } from "@prisma/client";
import type { PayoutAccountInput } from "@skillstream/shared";
import { PrismaService } from "../prisma/prisma.service";

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class PayoutsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db) {
    return tx ?? this.prisma;
  }

  findPayeeContext(userId: string) {
    return Promise.all([
      this.prisma.instructorProfile.findUnique({ where: { userId } }),
      this.prisma.salesAgent.findUnique({ where: { userId } }),
    ]);
  }

  findPayoutAccount(userId: string) {
    return this.prisma.payoutAccount.findUnique({ where: { userId } });
  }

  findBalanceInputs(userId: string, openStatuses: PayoutStatus[]) {
    return Promise.all([
      this.prisma.payoutAccount.findUnique({ where: { userId } }),
      this.prisma.payout.aggregate({
        where: { payeeUserId: userId, status: "PAID" },
        _sum: { amountCents: true },
      }),
      this.prisma.payout.aggregate({
        where: { payeeUserId: userId, status: { in: openStatuses } },
        _sum: { amountCents: true },
      }),
    ]);
  }

  upsertPayoutAccount(userId: string, input: PayoutAccountInput) {
    return this.prisma.payoutAccount.upsert({
      where: { userId },
      update: input,
      create: { userId, ...input },
    });
  }

  createPayout(data: Prisma.PayoutUncheckedCreateInput) {
    return this.prisma.payout.create({ data });
  }

  findMyPayouts(userId: string) {
    return this.prisma.payout.findMany({
      where: { payeeUserId: userId },
      orderBy: { requestedAt: "desc" },
      include: { payee: { select: { name: true, email: true } } },
    });
  }

  findAll(status?: Payout["status"]) {
    return this.prisma.payout.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
      include: { payee: { select: { name: true, email: true } } },
    });
  }

  findPayoutById(id: string) {
    return this.prisma.payout.findUnique({ where: { id } });
  }

  updatePayoutWithPayee(id: string, data: Prisma.PayoutUpdateInput, tx?: Db) {
    return this.db(tx).payout.update({
      where: { id },
      data,
      include: { payee: { select: { name: true, email: true } } },
    });
  }

  findSalesAgentIdByUser(userId: string, tx?: Db) {
    return this.db(tx).salesAgent.findUnique({
      where: { userId },
      select: { id: true },
    });
  }

  applyAgentPayoutSettlement(agentId: string, amountCents: number, tx?: Db) {
    return this.db(tx).salesAgent.update({
      where: { id: agentId },
      data: {
        pendingEarningsCents: { decrement: amountCents },
        paidEarningsCents: { increment: amountCents },
      },
    });
  }

  markAgentReferralsPaid(agentId: string, tx?: Db) {
    return this.db(tx).salesAgentReferral.updateMany({
      where: { agentId, status: "confirmed" },
      data: { status: "paid" },
    });
  }
}
