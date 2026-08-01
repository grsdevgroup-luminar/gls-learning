import { Injectable } from "@nestjs/common";
import { Prisma, SalesAgentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export const agentSelect = {
  id: true,
  userId: true,
  referralCode: true,
  commissionPercent: true,
  region: true,
  status: true,
  totalEarningsCents: true,
  pendingEarningsCents: true,
  paidEarningsCents: true,
  referralCount: true,
  createdAt: true,
  user: { select: { name: true, email: true } },
} satisfies Prisma.SalesAgentSelect;

export type SalesAgentRow = Prisma.SalesAgentGetPayload<{
  select: typeof agentSelect;
}>;

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class SalesAgentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db) {
    return tx ?? this.prisma;
  }

  findPendingApplicationByUser(userId: string) {
    return this.prisma.salesAgentApplication.findFirst({
      where: { userId, status: "PENDING" },
    });
  }

  createApplication(
    data: Prisma.SalesAgentApplicationUncheckedCreateInput,
  ) {
    return this.prisma.salesAgentApplication.create({ data });
  }

  findManyApplications(status?: SalesAgentStatus) {
    return this.prisma.salesAgentApplication.findMany({
      where: status ? { status } : undefined,
      orderBy: { appliedAt: "desc" },
    });
  }

  findApplicationById(appId: string) {
    return this.prisma.salesAgentApplication.findUnique({
      where: { id: appId },
    });
  }

  runTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(fn);
  }

  updateApplication(
    appId: string,
    data: Prisma.SalesAgentApplicationUpdateInput,
    tx?: Db,
  ) {
    return this.db(tx).salesAgentApplication.update({
      where: { id: appId },
      data,
    });
  }

  updateUserRole(
    userId: string,
    role: Prisma.UserUpdateInput["role"],
    tx?: Db,
  ) {
    return this.db(tx).user.update({
      where: { id: userId },
      data: { role },
    });
  }

  upsertSalesAgent(
    userId: string,
    referralCode: string,
    region: string,
    commissionPercent: number,
    tx?: Db,
  ) {
    return this.db(tx).salesAgent.upsert({
      where: { userId },
      update: { status: "APPROVED" },
      create: {
        userId,
        referralCode,
        region,
        status: "APPROVED",
        commissionPercent,
      },
    });
  }

  findAgentByUserId(userId: string) {
    return this.prisma.salesAgent.findUnique({
      where: { userId },
      select: agentSelect,
    });
  }

  findAgentIdByUserId(userId: string) {
    return this.prisma.salesAgent.findUnique({
      where: { userId },
      select: { id: true },
    });
  }

  findReferralsByAgent(agentId: string) {
    return this.prisma.salesAgentReferral.findMany({
      where: { agentId },
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          include: { user: { select: { name: true } }, items: true },
        },
      },
    });
  }

  findManyAgents() {
    return this.prisma.salesAgent.findMany({
      select: agentSelect,
      orderBy: { createdAt: "desc" },
    });
  }

  updateAgent(agentId: string, data: Prisma.SalesAgentUpdateInput) {
    return this.prisma.salesAgent.update({
      where: { id: agentId },
      data,
      select: agentSelect,
    });
  }

  findAgentByReferralCode(referralCode: string) {
    return this.prisma.salesAgent.findUnique({
      where: { referralCode },
    });
  }

  findOrderTotalById(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      select: { totalCents: true },
    });
  }

  findReferralByOrderId(orderId: string) {
    return this.prisma.salesAgentReferral.findUnique({
      where: { orderId },
    });
  }

  createPendingReferralTx(
    agentId: string,
    orderId: string,
    commissionCents: number,
    referralCode: string,
  ) {
    return this.prisma.$transaction([
      this.prisma.salesAgentReferral.create({
        data: { agentId, orderId, commissionCents, status: "pending" },
      }),
      this.prisma.salesAgent.update({
        where: { id: agentId },
        data: { referralCount: { increment: 1 } },
      }),
      // Stamp the order so reporting can join on agentId without going through the referral table.
      this.prisma.order.update({
        where: { id: orderId },
        data: { agentId, agentReferralCode: referralCode },
      }),
    ]);
  }

  confirmReferralTx(
    orderId: string,
    agentId: string,
    commissionCents: number,
  ) {
    return this.prisma.$transaction([
      this.prisma.salesAgentReferral.update({
        where: { orderId },
        data: { status: "confirmed" },
      }),
      this.prisma.salesAgent.update({
        where: { id: agentId },
        data: {
          pendingEarningsCents: { increment: commissionCents },
          totalEarningsCents: { increment: commissionCents },
        },
      }),
    ]);
  }
}
