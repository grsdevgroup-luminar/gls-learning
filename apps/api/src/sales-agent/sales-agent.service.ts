import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SalesAgentStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type {
  ApplySalesAgentInput,
  ReviewAgentApplicationInput,
  SalesAgentDto,
  SalesAgentReferralDto,
  UpdateAgentInput,
} from "@skillstream/shared";
import type { RequestUser } from "../common/decorators";
import { EmailService } from "../email/email.service";
import {
  SalesAgentRepository,
  type SalesAgentRow,
} from "./sales-agent.repository";

@Injectable()
export class SalesAgentService {
  constructor(
    private readonly repo: SalesAgentRepository,
    private readonly email: EmailService,
  ) {}

  private toDto(a: SalesAgentRow): SalesAgentDto {
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
    const existing = await this.repo.findPendingApplicationByUser(user.id);
    if (existing) throw new BadRequestException("You already have a pending application");
    const app = await this.repo.createApplication({
      userId: user.id,
      ...input,
      status: "PENDING",
    });
    return app;
  }

  listApplications(status?: SalesAgentStatus) {
    return this.repo.findManyApplications(status);
  }

  async reviewApplication(appId: string, input: ReviewAgentApplicationInput) {
    const app = await this.repo.findApplicationById(appId);
    if (!app) throw new NotFoundException("Application not found");

    const result = await this.repo.runTransaction(async (tx) => {
      const updated = await this.repo.updateApplication(
        appId,
        { status: input.status, reviewedAt: new Date(), note: input.note },
        tx,
      );
      if (input.status === "APPROVED" && app.userId) {
        await this.repo.updateUserRole(app.userId, "SALES_AGENT", tx);
        await this.repo.upsertSalesAgent(
          app.userId,
          this.generateCode(),
          app.region,
          input.commissionPercent ?? 10,
          tx,
        );
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
    const a = await this.repo.findAgentByUserId(user.id);
    return a ? this.toDto(a) : null;
  }

  async myReferrals(user: RequestUser): Promise<SalesAgentReferralDto[]> {
    const agent = await this.repo.findAgentIdByUserId(user.id);
    if (!agent) return [];
    return this.referralsForAgent(agent.id);
  }

  private async referralsForAgent(agentId: string): Promise<SalesAgentReferralDto[]> {
    const rows = await this.repo.findReferralsByAgent(agentId);
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
    const rows = await this.repo.findManyAgents();
    return rows.map((a) => this.toDto(a));
  }

  async updateAgent(agentId: string, input: UpdateAgentInput): Promise<SalesAgentDto> {
    const a = await this.repo.updateAgent(agentId, {
      commissionPercent: input.commissionPercent,
      status: input.status,
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
    const agent = await this.repo.findAgentByReferralCode(referralCode);
    if (!agent || agent.status !== "APPROVED") return;

    const order = await this.repo.findOrderTotalById(orderId);
    if (!order) return;

    const exists = await this.repo.findReferralByOrderId(orderId);
    if (exists) return;

    const commissionCents = Math.round(
      order.totalCents * (agent.commissionPercent / 100),
    );
    await this.repo.createPendingReferralTx(
      agent.id,
      orderId,
      commissionCents,
      referralCode,
    );
  }

  /** Confirms a referral once its order is paid, crediting the agent's
   *  pending/total earnings. Idempotent. */
  async confirmReferral(orderId: string): Promise<void> {
    const referral = await this.repo.findReferralByOrderId(orderId);
    if (!referral || referral.status !== "pending") return;
    await this.repo.confirmReferralTx(
      orderId,
      referral.agentId,
      referral.commissionCents,
    );
  }
}
