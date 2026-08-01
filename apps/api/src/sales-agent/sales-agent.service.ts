import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, SalesAgentStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type {
  ApplySalesAgentInput,
  ReviewAgentApplicationInput,
  SalesAgentDto,
  SalesAgentReferralDto,
  UpdateAgentInput,
} from "@skillstream/shared";
import type { RequestUser } from "../common/decorators";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";

const agentSelect = {
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

@Injectable()
export class SalesAgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  private toDto(a: Prisma.SalesAgentGetPayload<{ select: typeof agentSelect }>): SalesAgentDto {
    return {
      id: a.id,
      userId: a.userId,
      name: a.user.name,
      email: a.user.email,
      region: a.region,
      referralCode: a.referralCode,
      commissionPercent: a.commissionPercent,
      status: a.status,
      totalEarningsCents: a.totalEarningsCents,
      pendingEarningsCents: a.pendingEarningsCents,
      paidEarningsCents: a.paidEarningsCents,
      referralCount: a.referralCount,
      createdAt: a.createdAt.toISOString(),
    };
  }

  // ── application ──────────────────────────────────────────────────────────
  async apply(user: RequestUser, input: ApplySalesAgentInput) {
    const existing = await this.prisma.salesAgentApplication.findFirst({
      where: { userId: user.id, status: "PENDING" },
    });
    if (existing) throw new BadRequestException("You already have a pending application");
    const app = await this.prisma.salesAgentApplication.create({
      data: { userId: user.id, ...input, status: "PENDING" },
    });
    return app;
  }

  listApplications(status?: SalesAgentStatus) {
    return this.prisma.salesAgentApplication.findMany({
      where: status ? { status } : undefined,
      orderBy: { appliedAt: "desc" },
    });
  }

  async reviewApplication(appId: string, input: ReviewAgentApplicationInput) {
    const app = await this.prisma.salesAgentApplication.findUnique({
      where: { id: appId },
    });
    if (!app) throw new NotFoundException("Application not found");

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.salesAgentApplication.update({
        where: { id: appId },
        data: { status: input.status, reviewedAt: new Date(), note: input.note },
      });
      if (input.status === "APPROVED" && app.userId) {
        await tx.user.update({
          where: { id: app.userId },
          data: { role: "SALES_AGENT" },
        });
        await tx.salesAgent.upsert({
          where: { userId: app.userId },
          update: { status: "APPROVED" },
          create: {
            userId: app.userId,
            referralCode: this.generateCode(),
            region: app.region,
            status: "APPROVED",
            commissionPercent: input.commissionPercent ?? 10,
          },
        });
      }
      return updated;
    });

    // Same promise as the instructor flow: the applicant hears back by email.
    void this.email
      .sendApplicationDecision(
        result.email,
        result.name,
        "sales agent",
        result.status === "APPROVED",
        result.note,
      )
      .catch(() => undefined);
    return result;
  }

  private generateCode(): string {
    return `REF-${randomUUID().slice(0, 6).toUpperCase()}`;
  }

  // ── agent self ───────────────────────────────────────────────────────────
  async me(user: RequestUser): Promise<SalesAgentDto | null> {
    const a = await this.prisma.salesAgent.findUnique({
      where: { userId: user.id },
      select: agentSelect,
    });
    return a ? this.toDto(a) : null;
  }

  async myReferrals(user: RequestUser): Promise<SalesAgentReferralDto[]> {
    const agent = await this.prisma.salesAgent.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!agent) return [];
    return this.referralsForAgent(agent.id);
  }

  private async referralsForAgent(agentId: string): Promise<SalesAgentReferralDto[]> {
    const rows = await this.prisma.salesAgentReferral.findMany({
      where: { agentId },
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          include: { user: { select: { name: true } }, items: true },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      agentId: r.agentId,
      studentName: r.order.user.name,
      courseTitle: r.order.items.map((i) => i.titleSnapshot).join(", "),
      orderTotalCents: r.order.totalCents,
      commissionCents: r.commissionCents,
      status: r.status as "pending" | "confirmed" | "paid",
      createdAt: r.createdAt.toISOString(),
    }));
  }

  // ── admin ──────────────────────────────────────────────────────────────
  async listAgents(): Promise<SalesAgentDto[]> {
    const rows = await this.prisma.salesAgent.findMany({
      select: agentSelect,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((a) => this.toDto(a));
  }

  async updateAgent(agentId: string, input: UpdateAgentInput): Promise<SalesAgentDto> {
    const a = await this.prisma.salesAgent.update({
      where: { id: agentId },
      data: { commissionPercent: input.commissionPercent, status: input.status },
      select: agentSelect,
    });
    return this.toDto(a);
  }

  // ── referral attribution (called from checkout / fulfillment) ───────────
  /** Attaches a pending referral to a freshly-created order. No earnings are
   *  credited until the order is paid (see confirmReferral). */
  async createPendingReferral(
    orderId: string,
    referralCode: string,
  ): Promise<void> {
    const agent = await this.prisma.salesAgent.findUnique({
      where: { referralCode },
    });
    if (!agent || agent.status !== "APPROVED") return;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { totalCents: true },
    });
    if (!order) return;

    const exists = await this.prisma.salesAgentReferral.findUnique({
      where: { orderId },
    });
    if (exists) return;

    const commissionCents = Math.round(
      order.totalCents * (agent.commissionPercent / 100),
    );
    await this.prisma.$transaction([
      this.prisma.salesAgentReferral.create({
        data: { agentId: agent.id, orderId, commissionCents, status: "pending" },
      }),
      this.prisma.salesAgent.update({
        where: { id: agent.id },
        data: { referralCount: { increment: 1 } },
      }),
      // Stamp the order so reporting can join on agentId without going through the referral table.
      this.prisma.order.update({
        where: { id: orderId },
        data: { agentId: agent.id, agentReferralCode: referralCode },
      }),
    ]);
  }

  /** Confirms a referral once its order is paid, crediting the agent's
   *  pending/total earnings. Idempotent. */
  async confirmReferral(orderId: string): Promise<void> {
    const referral = await this.prisma.salesAgentReferral.findUnique({
      where: { orderId },
    });
    if (!referral || referral.status !== "pending") return;
    await this.prisma.$transaction([
      this.prisma.salesAgentReferral.update({
        where: { orderId },
        data: { status: "confirmed" },
      }),
      this.prisma.salesAgent.update({
        where: { id: referral.agentId },
        data: {
          pendingEarningsCents: { increment: referral.commissionCents },
          totalEarningsCents: { increment: referral.commissionCents },
        },
      }),
    ]);
  }
}
