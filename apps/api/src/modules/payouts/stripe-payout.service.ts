import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import type { PayoutStripeStatusDto, StripeOnboardLinkDto } from "@skillstream/shared";
import type { Env } from "../../config/env";

/**
 * Stripe Connect Express integration for instructor payouts.
 *
 * Responsibilities:
 *  - Provision `acct_xxx` connected accounts on demand and hand back hosted
 *    onboarding links (Stripe collects KYC + bank details — we never touch
 *    them).
 *  - Report live account status so the UI can show verification gaps.
 *  - Push a `Transfer` from the platform Stripe balance to the connected
 *    account when a payout is approved. Uses Stripe's idempotency header so
 *    retries never double-pay.
 *
 * All methods refuse cleanly (`503`) when `STRIPE_SECRET_KEY` is unset so the
 * rest of the app stays bootable without Stripe in dev/test.
 */
@Injectable()
export class StripePayoutService {
  private readonly logger = new Logger(StripePayoutService.name);
  private readonly client: Stripe | null;

  constructor(private readonly config: ConfigService<Env, true>) {
    const key = this.config.get("STRIPE_SECRET_KEY", { infer: true });
    this.client = key ? new Stripe(key) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private requireClient(): Stripe {
    if (!this.client)
      throw new ServiceUnavailableException("Stripe is not configured");
    return this.client;
  }

  /** Creates a Stripe Express account for the user if one doesn't already
   *  exist on the given `existingAccountId`. Returns the account id to persist
   *  in `PayoutAccount.details`. */
  async ensureConnectedAccount(input: {
    existingAccountId: string | null;
    email: string;
    userId: string;
  }): Promise<string> {
    const stripe = this.requireClient();
    if (input.existingAccountId) return input.existingAccountId;

    const account = await stripe.accounts.create({
      type: "express",
      email: input.email,
      capabilities: {
        transfers: { requested: true },
      },
      metadata: { userId: input.userId },
    });
    return account.id;
  }

  /** Issues a fresh hosted onboarding link. Links are single-use and expire
   *  in a few minutes — always mint a new one when the instructor clicks
   *  "Connect with Stripe" or "Complete verification". */
  async createOnboardingLink(accountId: string): Promise<StripeOnboardLinkDto> {
    const stripe = this.requireClient();
    const returnUrl = this.config.get("STRIPE_CONNECT_RETURN_URL", { infer: true });
    const refreshUrl = this.config.get("STRIPE_CONNECT_REFRESH_URL", { infer: true });
    if (!returnUrl || !refreshUrl)
      throw new ServiceUnavailableException("Stripe Connect URLs not configured");

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });
    return {
      url: link.url,
      expiresAt: new Date(link.expires_at * 1000).toISOString(),
    };
  }

  /** Live status snapshot; UI polls this after the instructor returns from
   *  onboarding to know whether the "Withdraw" button is safe to enable. */
  async getAccountStatus(
    accountId: string | null,
  ): Promise<PayoutStripeStatusDto> {
    if (!accountId) {
      return {
        connected: false,
        connectedAccountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        requirementsDue: [],
      };
    }
    const stripe = this.requireClient();
    const acct = await stripe.accounts.retrieve(accountId);
    const requirementsDue = [
      ...(acct.requirements?.currently_due ?? []),
      ...(acct.requirements?.past_due ?? []),
    ];
    return {
      connected: true,
      connectedAccountId: acct.id,
      chargesEnabled: acct.charges_enabled,
      payoutsEnabled: acct.payouts_enabled,
      detailsSubmitted: acct.details_submitted,
      requirementsDue: Array.from(new Set(requirementsDue)),
    };
  }

  /** Pushes money from the platform Stripe balance to the payee's connected
   *  account. `netCents` is the amount that lands in the instructor's
   *  account — the platform fee is already deducted upstream.
   *
   *  `payoutId` doubles as the Stripe idempotency key so a retried request
   *  (network hiccup, worker restart) returns the same Transfer instead of
   *  creating a second one. */
  async executeTransfer(input: {
    payoutId: string;
    destinationAccountId: string;
    netCents: number;
    payeeUserId: string;
  }): Promise<{ providerRef: string }> {
    if (input.netCents <= 0)
      throw new BadRequestException("Cannot transfer non-positive amount");
    const stripe = this.requireClient();

    try {
      const transfer = await stripe.transfers.create(
        {
          amount: input.netCents,
          currency: "usd",
          destination: input.destinationAccountId,
          transfer_group: input.payoutId,
          metadata: {
            payoutId: input.payoutId,
            payeeUserId: input.payeeUserId,
          },
        },
        { idempotencyKey: `payout_${input.payoutId}` },
      );
      return { providerRef: transfer.id };
    } catch (err) {
      this.logger.error(
        `Stripe transfer failed for payout ${input.payoutId}: ${(err as Error).message}`,
      );
      throw err;
    }
  }
}
