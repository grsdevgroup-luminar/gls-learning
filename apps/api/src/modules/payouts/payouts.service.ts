import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PayeeType, Payout } from "@prisma/client";
import {
  MIN_PAYOUT_CENTS,
  STRIPE_CONNECTED_ACCOUNT_RE,
  type AdminPayoutQuery,
  type PayoutAccountDto,
  type PayoutAccountInput,
  type PayoutBalanceDto,
  type PayoutBreakdownDto,
  type PayoutDto,
  type PayoutStripeStatusDto,
  type RequestPayoutInput,
  type StripeOnboardLinkDto,
} from "@skillstream/shared";
import type { RequestUser } from "../../common/decorators/decorators";
import type { Env } from "../../config/env";
import { PrismaService } from "../../prisma/prisma.service";
import {
  NotificationsService,
  type NotifyInput,
} from "../notifications/notifications.service";
import { calculatePayoutBreakdown } from "./fees/fee-calculator";
import { PayoutsRepository } from "./payouts.repository";
import { StripePayoutService } from "./stripe-payout.service";

const OPEN = ["REQUESTED", "APPROVED"] as const;

/** Where a payout notification should deep-link, by payee role. */
function payoutHref(payeeType: PayeeType): string {
  return payeeType === "DELIVERY_PARTNER" ? "/delivery-partner/earnings" : "/instructor/earnings";
}

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
    private readonly notifications: NotificationsService,
    private readonly stripe: StripePayoutService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Maps a user's role to which earnings pool their payouts draw from.
   *  Instructors and delivery partners each have exactly one; anyone else can't
   *  request payouts. */
  private async payeeContext(
    userId: string,
  ): Promise<{ payeeType: PayeeType; lifetimeEarnedCents: number }> {
    const [instructor, partner] = await this.repo.findPayeeContext(userId);
    if (partner)
      return { payeeType: "DELIVERY_PARTNER", lifetimeEarnedCents: partner.totalEarningsCents };
    if (instructor)
      return {
        payeeType: "INSTRUCTOR",
        lifetimeEarnedCents: instructor.earningsCents,
      };
    throw new ForbiddenException("Only instructors and delivery partners have payouts");
  }

  private feeConfig() {
    return {
      platformFeeBps: this.config.get("PAYOUT_PLATFORM_FEE_BPS", { infer: true }),
      minNetCents: this.config.get("PAYOUT_MIN_NET_CENTS", { infer: true }),
    };
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
    // A STRIPE account can only be set by the onboarding flow, which writes
    // the validated `acct_xxx` id itself. Rejecting arbitrary strings here
    // prevents a payee from spoofing another connected account.
    if (input.method === "STRIPE" && !STRIPE_CONNECTED_ACCOUNT_RE.test(input.details))
      throw new BadRequestException(
        "Use POST /me/payout-account/stripe/onboard-link to connect Stripe",
      );
    const a = await this.repo.upsertPayoutAccount(user.id, input);
    return { method: a.method, details: a.details, updatedAt: a.updatedAt.toISOString() };
  }

  // ── Stripe Connect onboarding ─────────────────────────────────────────────
  /** Creates an `acct_xxx` if the instructor has none, persists it on their
   *  `PayoutAccount`, then hands back a hosted onboarding link Stripe will
   *  use to collect KYC + bank details. Safe to call repeatedly — reuses the
   *  existing account and just mints a fresh link. */
  async createStripeOnboardLink(user: RequestUser): Promise<StripeOnboardLinkDto> {
    await this.payeeContext(user.id);
    const existing = await this.repo.findPayoutAccount(user.id);
    const existingAccountId =
      existing && existing.method === "STRIPE" ? existing.details : null;
    const emailRow = await this.repo.findUserEmail(user.id);
    if (!emailRow) throw new NotFoundException("User not found");

    const accountId = await this.stripe.ensureConnectedAccount({
      existingAccountId,
      email: emailRow.email,
      userId: user.id,
    });

    if (!existing || existing.method !== "STRIPE" || existing.details !== accountId) {
      await this.repo.upsertPayoutAccount(user.id, {
        method: "STRIPE",
        details: accountId,
      });
    }

    return this.stripe.createOnboardingLink(accountId);
  }

  async getStripeStatus(user: RequestUser): Promise<PayoutStripeStatusDto> {
    await this.payeeContext(user.id);
    const account = await this.repo.findPayoutAccount(user.id);
    const accountId =
      account && account.method === "STRIPE" ? account.details : null;
    return this.stripe.getAccountStatus(accountId);
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

  /** Live fee preview for the UI's withdrawal modal — no writes, no side
   *  effects. Applies the same guards the real request would (available
   *  balance, minimum net) so the button state matches server truth. */
  async quote(user: RequestUser, amountCents: number): Promise<PayoutBreakdownDto> {
    const balance = await this.myBalance(user);
    if (amountCents > balance.availableCents)
      throw new BadRequestException("Amount exceeds available balance");
    return calculatePayoutBreakdown(amountCents, this.feeConfig());
  }

  /** Requests a payout. When `amountCents` is omitted, drains the full
   *  available balance (legacy behavior). Guards against missing account,
   *  an already-open request, and below-threshold *net* amounts. */
  async request(
    user: RequestUser,
    body: RequestPayoutInput = {},
  ): Promise<PayoutDto> {
    const account = await this.repo.findPayoutAccount(user.id);
    if (!account)
      throw new BadRequestException("Add a payout account before requesting");

    const balance = await this.myBalance(user);
    if (balance.hasOpenRequest)
      throw new BadRequestException("You already have a pending payout request");

    const requestedCents = body.amountCents ?? balance.availableCents;
    if (requestedCents <= 0)
      throw new BadRequestException("Amount must be positive");
    if (requestedCents > balance.availableCents)
      throw new BadRequestException("Amount exceeds available balance");
    if (requestedCents < MIN_PAYOUT_CENTS)
      throw new BadRequestException(
        `Minimum payout is $${(MIN_PAYOUT_CENTS / 100).toFixed(0)}`,
      );

    // Stripe-only extras: connected account must be ready to receive payouts.
    if (account.method === "STRIPE") {
      const status = await this.stripe.getAccountStatus(account.details);
      if (!status.payoutsEnabled)
        throw new BadRequestException(
          "Finish Stripe onboarding before requesting a payout",
        );
    }

    const breakdown = calculatePayoutBreakdown(requestedCents, this.feeConfig());
    if (!breakdown.meetsMinimum)
      throw new BadRequestException(
        `After fees you would receive less than the $${(breakdown.minNetCents / 100).toFixed(2)} minimum`,
      );

    const payout = await this.repo.createPayout({
      payeeUserId: user.id,
      payeeType: balance.payeeType,
      amountCents: requestedCents,
      netCents: breakdown.netCents,
      platformFeeCents: breakdown.platformFeeCents,
      stripeFeeCents: breakdown.stripeFeeCents,
      method: account.method,
      destination: account.details,
      status: "REQUESTED",
    });

    void this.notifications
      .notify({
        userId: user.id,
        event: "PAYOUT_REQUESTED",
        title: "Payout requested",
        body: `Your $${(requestedCents / 100).toFixed(2)} payout is pending admin review.`,
        href: payoutHref(balance.payeeType),
      })
      .catch(() => undefined);

    return this.toDto(payout, { name: "", email: "" });
  }

  async myPayouts(user: RequestUser): Promise<PayoutDto[]> {
    const rows = await this.repo.findMyPayouts(user.id);
    return rows.map((r) => this.toDto(r, r.payee));
  }

  // ── admin ──────────────────────────────────────────────────────────────────
  async listAll(filters: AdminPayoutQuery = {}): Promise<PayoutDto[]> {
    const rows = await this.repo.findAll(filters);
    return rows.map((r) => this.toDto(r, r.payee));
  }

  /** Approves a payout. For STRIPE payouts this also executes the Stripe
   *  Transfer synchronously — a successful Transfer transitions the row
   *  straight to PAID and writes back the Stripe transfer id. For legacy
   *  PAYPAL/BANK payouts the row goes to APPROVED and awaits `markPaid`. */
  async approve(admin: RequestUser, id: string): Promise<PayoutDto> {
    const payout = await this.getInStatus(id, "REQUESTED");

    if (payout.method === "STRIPE") {
      const notifyInput: NotifyInput = {
        userId: payout.payeeUserId,
        event: "PAYOUT_PAID",
        title: "Payout sent",
        body: `Your $${(payout.netCents / 100).toFixed(2)} payout was sent to your Stripe account.`,
        href: payoutHref(payout.payeeType),
      };

      const transfer = await this.stripe.executeTransfer({
        payoutId: payout.id,
        destinationAccountId: payout.destination,
        netCents: payout.netCents,
        payeeUserId: payout.payeeUserId,
      });

      const updated = await this.prisma.$transaction(async (tx) => {
        const paid = await this.repo.updatePayoutWithPayee(
          id,
          {
            status: "PAID",
            processedAt: new Date(),
            processedBy: admin.id,
            providerRef: transfer.providerRef,
          },
          tx,
        );
        await this.notifications.notify(notifyInput, tx);
        return paid;
      });
      void this.notifications
        .notifyEmailAfterCommit(notifyInput)
        .catch(() => undefined);
      return this.toDto(updated, updated.payee);
    }

    const updated = await this.repo.updatePayoutWithPayee(id, {
      status: "APPROVED",
      processedBy: admin.id,
    });
    void this.notifications
      .notify({
        userId: payout.payeeUserId,
        event: "PAYOUT_APPROVED",
        title: "Payout approved",
        body: `Your $${(payout.amountCents / 100).toFixed(2)} payout was approved and is being processed.`,
        href: payoutHref(payout.payeeType),
      })
      .catch(() => undefined);
    return this.toDto(updated, updated.payee);
  }

  /** Confirms the transfer has been sent. Keeps the delivery-partner display counters
   *  (pending/paid) in sync so both the partner UI and this ledger agree. */
  async markPaid(admin: RequestUser, id: string): Promise<PayoutDto> {
    const payout = await this.repo.findPayoutById(id);
    if (!payout) throw new NotFoundException("Payout not found");
    if (payout.status !== "REQUESTED" && payout.status !== "APPROVED")
      throw new BadRequestException("Only open payouts can be marked paid");

    const notifyInput: NotifyInput = {
      userId: payout.payeeUserId,
      event: "PAYOUT_PAID",
      title: "Payout sent",
      body: `Your $${(payout.amountCents / 100).toFixed(2)} payout has been paid.`,
      href: payoutHref(payout.payeeType),
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      if (payout.payeeType === "DELIVERY_PARTNER") {
        const partner = await this.repo.findDeliveryPartnerIdByUser(payout.payeeUserId, tx);
        if (partner) {
          await this.repo.applyPartnerPayoutSettlement(
            partner.id,
            payout.amountCents,
            tx,
          );
          await this.repo.markPartnerReferralsPaid(partner.id, tx);
        }
      }
      const paid = await this.repo.updatePayoutWithPayee(
        id,
        { status: "PAID", processedAt: new Date(), processedBy: admin.id },
        tx,
      );
      await this.notifications.notify(notifyInput, tx);
      return paid;
    });
    void this.notifications.notifyEmailAfterCommit(notifyInput).catch(() => undefined);
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
      netCents: p.netCents,
      platformFeeCents: p.platformFeeCents,
      stripeFeeCents: p.stripeFeeCents,
      status: p.status,
      method: p.method,
      destination: p.destination,
      providerRef: p.providerRef,
      note: p.note,
      requestedAt: p.requestedAt.toISOString(),
      processedAt: p.processedAt?.toISOString() ?? null,
    };
  }
}
