import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { PayeeType } from "@prisma/client";
import Stripe from "stripe";
import type { PayoutStripeStatusDto, StripeOnboardLinkDto } from "@grslearning/shared";
import type { Env } from "../../config/env";

/**
 * Stripe Connect Express integration for instructor and delivery-partner
 * payouts.
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
  async createOnboardingLink(
    accountId: string,
    payeeType: PayeeType,
  ): Promise<StripeOnboardLinkDto> {
    const stripe = this.requireClient();
    const { returnUrl, refreshUrl } = this.onboardingUrls(payeeType);
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

  /** Where Stripe's hosted onboarding sends the payee back to — each payee
   *  type returns to its own portal's earnings page. Partner URLs default to
   *  `FRONTEND_URL/delivery-partner/earnings` when not set explicitly. */
  private onboardingUrls(payeeType: PayeeType) {
    if (payeeType === "DELIVERY_PARTNER") {
      const base = `${this.config.get("FRONTEND_URL", { infer: true }).replace(/\/$/, "")}/delivery-partner/earnings`;
      return {
        returnUrl:
          this.config.get("STRIPE_CONNECT_PARTNER_RETURN_URL", { infer: true }) ??
          `${base}?stripe=onboarded`,
        refreshUrl:
          this.config.get("STRIPE_CONNECT_PARTNER_REFRESH_URL", { infer: true }) ??
          `${base}?stripe=refresh`,
      };
    }
    return {
      returnUrl: this.config.get("STRIPE_CONNECT_RETURN_URL", { infer: true }),
      refreshUrl: this.config.get("STRIPE_CONNECT_REFRESH_URL", { infer: true }),
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
      // Checked up front rather than left to transfers.create: Stripe stores a
      // failed result against the idempotency key, so a transfer rejected for
      // insufficient funds would keep failing on retry even after the platform
      // balance is topped up.
      const balance = await stripe.balance.retrieve();
      const availableCents =
        balance.available.find((b) => b.currency === "usd")?.amount ?? 0;
      if (availableCents < input.netCents)
        throw insufficientBalance(input.netCents, availableCents);

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
      throw toHttpException(err, input.netCents);
    }
  }
}

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function insufficientBalance(neededCents: number, availableCents?: number): HttpException {
  const available =
    availableCents === undefined ? "" : ` (${usd(availableCents)} available)`;
  return new BadRequestException(
    `Insufficient funds in the platform Stripe balance to send ${usd(neededCents)}${available}. Add funds to Stripe, then approve again.`,
  );
}

/** Restates a Stripe failure as an HTTP error the admin can act on. Left as-is,
 *  the global filter hides anything that isn't an HttpException behind a
 *  generic 500. The payout stays REQUESTED either way, so approve can be
 *  retried once the cause is fixed. */
function toHttpException(err: unknown, netCents: number): unknown {
  if (err instanceof HttpException || !(err instanceof Stripe.errors.StripeError))
    return err;
  if (err.code === "balance_insufficient") return insufficientBalance(netCents);
  if (
    err instanceof Stripe.errors.StripeConnectionError ||
    err instanceof Stripe.errors.StripeAPIError ||
    err instanceof Stripe.errors.StripeRateLimitError
  )
    return new ServiceUnavailableException(
      "Stripe is not responding right now. Try approving again shortly.",
    );
  if (
    err instanceof Stripe.errors.StripeAuthenticationError ||
    err instanceof Stripe.errors.StripePermissionError
  )
    return new ServiceUnavailableException(
      "Stripe rejected the platform API key. Check the Stripe configuration.",
    );
  return new BadRequestException(`Stripe rejected the transfer: ${err.message}`);
}
