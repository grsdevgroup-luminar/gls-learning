import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PayeeType, Payout } from "@prisma/client";
import {
  MIN_PAYOUT_CENTS,
  type PayoutAccountDto,
  type PayoutAccountInput,
  type PayoutBalanceDto,
  type PayoutDto,
} from "@skillstream/shared";
import type { RequestUser } from "../../common/decorators/decorators";
import { PrismaService } from "../../prisma/prisma.service";
import { PayoutsRepository } from "./payouts.repository";

const OPEN = ["REQUESTED", "APPROVED"] as const;

/** Pure balance math, shared by the DTO builder and tested in isolation.
 *  available never goes negative; a payout can only be requested with an account,
 *  no in-flight request, and at least the minimum available. */
export function computeBalance(input: {
  lifetimeEarnedCents: number;
  paidOutCents: number;
  inFlightCents: number;
  minPayoutCents: number;
  hasAccount: boolean;
}) {
  const availableCents = Math.max(
    0,
    input.lifetimeEarnedCents - input.paidOutCents - input.inFlightCents,
  );
  const hasOpenRequest = input.inFlightCents > 0;
  return {
    availableCents,
    hasOpenRequest,
    canRequest:
      input.hasAccount && !hasOpenRequest && availableCents >= input.minPayoutCents,
  };
}

@Injectable()
export class PayoutsService {
  constructor(
    private readonly repo: PayoutsRepository,
    private readonly prisma: PrismaService,
  ) {}

  /** Maps a user's role to which earnings pool their payouts draw from.
   *  Instructors and sales agents each have exactly one; anyone else can't
   *  request payouts. */
  private async payeeContext(
    userId: string,
  ): Promise<{ payeeType: PayeeType; lifetimeEarnedCents: number }> {
    const [instructor, agent] = await this.repo.findPayeeContext(userId);
    if (agent)
      return { payeeType: "AGENT", lifetimeEarnedCents: agent.totalEarningsCents };
    if (instructor)
      return {
        payeeType: "INSTRUCTOR",
        lifetimeEarnedCents: instructor.earningsCents,
      };
    throw new ForbiddenException("Only instructors and sales agents have payouts");
  }

  // ── payout account ─────────────────────────────────────────────────────────
  async myAccount(user: RequestUser): Promise<PayoutAccountDto | null> {
    const a = await this.repo.findPayoutAccount(user.id);
    return a
      ? { method: a.method, details: a.details, updatedAt: a.updatedAt.toISOString() }
      : null;
  }

  async setAccount(
    user: RequestUser,
    input: PayoutAccountInput,
  ): Promise<PayoutAccountDto> {
    await this.payeeContext(user.id); // reject non-payees before storing anything
    const a = await this.repo.upsertPayoutAccount(user.id, input);
    return { method: a.method, details: a.details, updatedAt: a.updatedAt.toISOString() };
  }

  // ── balance / requesting ─────────────────────────────────────────────────
  async myBalance(user: RequestUser): Promise<PayoutBalanceDto> {
    const { payeeType, lifetimeEarnedCents } = await this.payeeContext(user.id);
    const [account, paid, inFlight] = await this.repo.findBalanceInputs(user.id, [
      ...OPEN,
    ]);
    const paidOutCents = paid._sum.amountCents ?? 0;
    const inFlightCents = inFlight._sum.amountCents ?? 0;
    const { availableCents, hasOpenRequest, canRequest } = computeBalance({
      lifetimeEarnedCents,
      paidOutCents,
      inFlightCents,
      minPayoutCents: MIN_PAYOUT_CENTS,
      hasAccount: !!account,
    });
    return {
      payeeType,
      lifetimeEarnedCents,
      paidOutCents,
      inFlightCents,
      availableCents,
      minPayoutCents: MIN_PAYOUT_CENTS,
      hasAccount: !!account,
      hasOpenRequest,
      canRequest,
    };
  }

  /** Requests a payout for the full available balance. Guards against missing
   *  account, an already-open request, and below-threshold balances. */
  async request(user: RequestUser): Promise<PayoutDto> {
    const account = await this.repo.findPayoutAccount(user.id);
    if (!account)
      throw new BadRequestException("Add a payout account before requesting");

    const balance = await this.myBalance(user);
    if (balance.hasOpenRequest)
      throw new BadRequestException("You already have a pending payout request");
    if (balance.availableCents < MIN_PAYOUT_CENTS)
      throw new BadRequestException(
        `Minimum payout is $${(MIN_PAYOUT_CENTS / 100).toFixed(0)}`,
      );

    const payout = await this.repo.createPayout({
      payeeUserId: user.id,
      payeeType: balance.payeeType,
      amountCents: balance.availableCents,
      method: account.method,
      destination: account.details,
      status: "REQUESTED",
    });
    return this.toDto(payout, { name: "", email: "" });
  }

  async myPayouts(user: RequestUser): Promise<PayoutDto[]> {
    const rows = await this.repo.findMyPayouts(user.id);
    return rows.map((r) => this.toDto(r, r.payee));
  }

  // ── admin ──────────────────────────────────────────────────────────────────
  async listAll(status?: Payout["status"]): Promise<PayoutDto[]> {
    const rows = await this.repo.findAll(status);
    return rows.map((r) => this.toDto(r, r.payee));
  }

  async approve(admin: RequestUser, id: string): Promise<PayoutDto> {
    await this.getInStatus(id, "REQUESTED");
    const updated = await this.repo.updatePayoutWithPayee(id, {
      status: "APPROVED",
      processedBy: admin.id,
    });
    return this.toDto(updated, updated.payee);
  }

  /** Confirms the transfer has been sent. Keeps the sales-agent display counters
   *  (pending/paid) in sync so both the agent UI and this ledger agree. */
  async markPaid(admin: RequestUser, id: string): Promise<PayoutDto> {
    const payout = await this.repo.findPayoutById(id);
    if (!payout) throw new NotFoundException("Payout not found");
    if (payout.status !== "REQUESTED" && payout.status !== "APPROVED")
      throw new BadRequestException("Only open payouts can be marked paid");

    const updated = await this.prisma.$transaction(async (tx) => {
      if (payout.payeeType === "AGENT") {
        const agent = await this.repo.findSalesAgentIdByUser(payout.payeeUserId, tx);
        if (agent) {
          await this.repo.applyAgentPayoutSettlement(
            agent.id,
            payout.amountCents,
            tx,
          );
          await this.repo.markAgentReferralsPaid(agent.id, tx);
        }
      }
      return this.repo.updatePayoutWithPayee(
        id,
        { status: "PAID", processedAt: new Date(), processedBy: admin.id },
        tx,
      );
    });
    return this.toDto(updated, updated.payee);
  }

  async reject(
    admin: RequestUser,
    id: string,
    note?: string,
  ): Promise<PayoutDto> {
    const payout = await this.repo.findPayoutById(id);
    if (!payout) throw new NotFoundException("Payout not found");
    if (payout.status === "PAID")
      throw new BadRequestException("Paid payouts cannot be rejected");
    const updated = await this.repo.updatePayoutWithPayee(id, {
      status: "REJECTED",
      note,
      processedAt: new Date(),
      processedBy: admin.id,
    });
    return this.toDto(updated, updated.payee);
  }

  private async getInStatus(id: string, status: Payout["status"]) {
    const payout = await this.repo.findPayoutById(id);
    if (!payout) throw new NotFoundException("Payout not found");
    if (payout.status !== status)
      throw new BadRequestException(`Payout is not ${status.toLowerCase()}`);
    return payout;
  }

  private toDto(
    p: Payout,
    payee: { name: string; email: string },
  ): PayoutDto {
    return {
      id: p.id,
      payeeUserId: p.payeeUserId,
      payeeName: payee.name,
      payeeEmail: payee.email,
      payeeType: p.payeeType,
      amountCents: p.amountCents,
      status: p.status,
      method: p.method,
      destination: p.destination,
      note: p.note,
      requestedAt: p.requestedAt.toISOString(),
      processedAt: p.processedAt?.toISOString() ?? null,
    };
  }
}
