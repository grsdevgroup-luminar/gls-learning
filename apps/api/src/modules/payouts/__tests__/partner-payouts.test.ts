import { describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import type { ConfigService } from "@nestjs/config";
import type { Payout } from "@prisma/client";
import type { Env } from "../../../config/env";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { NotificationsService } from "../../notifications/notifications.service";
import type { PayoutsRepository } from "../payouts.repository";
import { PayoutsService, referralIdsCoveredByPayouts } from "../payouts.service";
import { StripePayoutService } from "../stripe-payout.service";

const user = { id: "user_1" } as never;
const admin = { id: "admin_1" } as never;

function makePayout(overrides: Partial<Payout> = {}): Payout {
  return {
    id: "payout_1",
    payeeUserId: "user_1",
    payeeType: "DELIVERY_PARTNER",
    amountCents: 10000,
    netCents: 9475,
    platformFeeCents: 500,
    stripeFeeCents: 25,
    status: "REQUESTED",
    method: "STRIPE",
    destination: "acct_123",
    providerRef: null,
    note: null,
    requestedAt: new Date(),
    processedAt: null,
    processedBy: null,
    ...overrides,
  };
}

function makeService(
  repoOverrides: Partial<Record<keyof PayoutsRepository, unknown>> = {},
  stripeOverrides: Partial<Record<keyof StripePayoutService, unknown>> = {},
) {
  const repo = {
    findPayeeContext: vi
      .fn()
      .mockResolvedValue([null, { status: "APPROVED", totalEarningsCents: 20000 }]),
    findPayoutAccount: vi.fn().mockResolvedValue({ method: "STRIPE", details: "acct_123" }),
    findBalanceInputs: vi
      .fn()
      .mockResolvedValue([{}, { _sum: { amountCents: 0 } }, { _sum: { amountCents: 0 } }]),
    findPayoutById: vi.fn().mockResolvedValue(makePayout()),
    updatePayoutWithPayee: vi.fn().mockImplementation((id: string, data: object) =>
      Promise.resolve({ ...makePayout(), ...data, payee: { name: "P", email: "p@x" } }),
    ),
    findDeliveryPartnerIdByUser: vi.fn().mockResolvedValue({ id: "partner_1" }),
    applyPartnerPayoutSettlement: vi.fn().mockResolvedValue({ paidEarningsCents: 10000 }),
    findPayableReferrals: vi.fn().mockResolvedValue([
      { id: "r1", status: "CONFIRMED", commissionCents: 6000, reversedCents: 0 },
      { id: "r2", status: "CONFIRMED", commissionCents: 6000, reversedCents: 0 },
    ]),
    markReferralsPaid: vi.fn().mockResolvedValue(undefined),
    findUserEmail: vi.fn().mockResolvedValue({ email: "p@x" }),
    createPayout: vi.fn().mockImplementation((data: object) =>
      Promise.resolve({ ...makePayout(), ...data }),
    ),
    ...repoOverrides,
  } as unknown as PayoutsRepository;
  const prisma = {
    $transaction: vi.fn((fn: (tx: never) => unknown) => fn({} as never)),
  } as unknown as PrismaService;
  const notifications = {
    notify: vi.fn().mockResolvedValue(undefined),
    notifyEmailAfterCommit: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService;
  const stripe = {
    executeTransfer: vi.fn().mockResolvedValue({ providerRef: "tr_1" }),
    getAccountStatus: vi.fn().mockResolvedValue({ payoutsEnabled: true }),
    ensureConnectedAccount: vi.fn().mockResolvedValue("acct_123"),
    createOnboardingLink: vi.fn().mockResolvedValue({ url: "https://x", expiresAt: "" }),
    ...stripeOverrides,
  } as unknown as StripePayoutService;
  const config = {
    get: vi.fn((key: string) =>
      ({ PAYOUT_PLATFORM_FEE_BPS: 500, PAYOUT_MIN_NET_CENTS: 2500 })[key],
    ),
  } as unknown as ConfigService<Env, true>;
  return {
    service: new PayoutsService(repo, prisma, notifications, stripe, config),
    repo,
    stripe,
  };
}

describe("referralIdsCoveredByPayouts", () => {
  const refs = [
    { id: "a", status: "PAID", commissionCents: 3000, reversedCents: 0 },
    { id: "b", status: "CONFIRMED", commissionCents: 3000, reversedCents: 1000 },
    { id: "c", status: "CONFIRMED", commissionCents: 3000, reversedCents: 0 },
  ];

  it("marks only confirmed referrals fully covered, oldest first", () => {
    expect(referralIdsCoveredByPayouts(refs, 5000)).toEqual(["b"]);
  });

  it("leaves a partly covered referral confirmed", () => {
    expect(referralIdsCoveredByPayouts(refs, 4999)).toEqual([]);
  });

  it("carries earlier partial coverage into later payouts", () => {
    expect(referralIdsCoveredByPayouts(refs, 8000)).toEqual(["b", "c"]);
  });
});

describe("PayoutsService — delivery partner settlement", () => {
  it("Stripe approve settles the partner ledger inside the transaction", async () => {
    const { service, repo } = makeService();
    const dto = await service.approve(admin, "payout_1");

    expect(dto.status).toBe("PAID");
    expect(repo.applyPartnerPayoutSettlement).toHaveBeenCalledWith("partner_1", 10000, {});
    // $100 paid out covers r1 ($60) but not r1+r2 ($120).
    expect(repo.markReferralsPaid).toHaveBeenCalledWith(["r1"], {});
  });

  it("manual mark-paid uses the same settlement", async () => {
    const { service, repo } = makeService({
      findPayoutById: vi.fn().mockResolvedValue(makePayout({ method: "PAYPAL", status: "APPROVED" })),
    });
    await service.markPaid(admin, "payout_1");

    expect(repo.applyPartnerPayoutSettlement).toHaveBeenCalledWith("partner_1", 10000, {});
    expect(repo.markReferralsPaid).toHaveBeenCalledWith(["r1"], {});
  });

  it("instructor approve never touches partner tables", async () => {
    const { service, repo } = makeService({
      findPayoutById: vi.fn().mockResolvedValue(makePayout({ payeeType: "INSTRUCTOR" })),
    });
    await service.approve(admin, "payout_1");

    expect(repo.findDeliveryPartnerIdByUser).not.toHaveBeenCalled();
    expect(repo.applyPartnerPayoutSettlement).not.toHaveBeenCalled();
  });
});

describe("PayoutsService — partner access and Stripe-only", () => {
  it("rejects payout requests from a partner who isn't approved", async () => {
    const { service, repo } = makeService({
      findPayeeContext: vi
        .fn()
        .mockResolvedValue([null, { status: "SUSPENDED", totalEarningsCents: 20000 }]),
    });
    await expect(service.request(user, { amountCents: 10000 })).rejects.toThrow(/not active/);
    await expect(service.createStripeOnboardLink(user)).rejects.toThrow(/not active/);
    expect(repo.createPayout).not.toHaveBeenCalled();
  });

  it("lets an inactive partner still read their balance", async () => {
    const { service } = makeService({
      findPayeeContext: vi
        .fn()
        .mockResolvedValue([null, { status: "SUSPENDED", totalEarningsCents: 20000 }]),
    });
    await expect(service.myBalance(user)).resolves.toMatchObject({ availableCents: 20000 });
  });

  it("rejects new requests against a legacy PayPal/Bank account", async () => {
    const { service, repo } = makeService({
      findPayoutAccount: vi.fn().mockResolvedValue({ method: "PAYPAL", details: "me@paypal.com" }),
    });
    await expect(service.request(user, { amountCents: 10000 })).rejects.toThrow(/Connect your Stripe/);
    expect(repo.createPayout).not.toHaveBeenCalled();
  });

  it("refuses to store a manual PayPal/Bank account", async () => {
    const { service } = makeService();
    await expect(
      service.setAccount(user, { method: "PAYPAL", details: "me@paypal.com" }),
    ).rejects.toThrow(/onboard-link/);
  });

  it("partner onboarding link is minted for the partner portal", async () => {
    const { service, stripe } = makeService();
    await service.createStripeOnboardLink(user);
    expect(stripe.createOnboardingLink).toHaveBeenCalledWith("acct_123", "DELIVERY_PARTNER");
  });
});

describe("StripePayoutService — onboarding return URLs", () => {
  function stripeWith(values: Record<string, string | undefined>) {
    const config = { get: vi.fn((k: string) => values[k]) } as unknown as ConfigService<Env, true>;
    const svc = new StripePayoutService(config);
    const create = vi.fn().mockResolvedValue({ url: "https://connect", expires_at: 0 });
    (svc as unknown as { client: unknown }).client = { accountLinks: { create } };
    return { svc, create };
  }

  it("sends partners back to the partner portal by default", async () => {
    const { svc, create } = stripeWith({
      FRONTEND_URL: "https://app.example/",
      STRIPE_CONNECT_RETURN_URL: "https://app.example/instructor/earnings?stripe=onboarded",
      STRIPE_CONNECT_REFRESH_URL: "https://app.example/instructor/earnings?stripe=refresh",
    });
    await svc.createOnboardingLink("acct_1", "DELIVERY_PARTNER");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        return_url: "https://app.example/delivery-partner/earnings?stripe=onboarded",
        refresh_url: "https://app.example/delivery-partner/earnings?stripe=refresh",
      }),
    );
  });

  it("keeps instructors on the configured instructor URLs", async () => {
    const { svc, create } = stripeWith({
      FRONTEND_URL: "https://app.example",
      STRIPE_CONNECT_RETURN_URL: "https://app.example/instructor/earnings?stripe=onboarded",
      STRIPE_CONNECT_REFRESH_URL: "https://app.example/instructor/earnings?stripe=refresh",
    });
    await svc.createOnboardingLink("acct_1", "INSTRUCTOR");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        return_url: "https://app.example/instructor/earnings?stripe=onboarded",
      }),
    );
  });
});

describe("StripePayoutService — executeTransfer errors", () => {
  const input = {
    payoutId: "po_1",
    destinationAccountId: "acct_1",
    netCents: 5000,
    payeeUserId: "u_1",
  };

  function stripeWith(availableCents: number, create = vi.fn()) {
    const config = { get: vi.fn(() => "sk_test") } as unknown as ConfigService<Env, true>;
    const svc = new StripePayoutService(config);
    (svc as unknown as { client: unknown }).client = {
      balance: {
        retrieve: vi.fn().mockResolvedValue({
          available: [{ currency: "usd", amount: availableCents }],
        }),
      },
      transfers: { create },
    };
    return { svc, create };
  }

  it("refuses with a 400 before calling Stripe when the platform balance is short", async () => {
    const { svc, create } = stripeWith(1200);
    await expect(svc.executeTransfer(input)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("$12.00 available"),
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("maps Stripe's balance_insufficient to a 400 instead of a 500", async () => {
    const create = vi.fn().mockRejectedValue(
      Stripe.errors.StripeError.generate({
        type: "invalid_request_error",
        code: "balance_insufficient",
        message: "You have insufficient available funds in your Stripe account.",
      }),
    );
    const { svc } = stripeWith(10_000, create);
    await expect(svc.executeTransfer(input)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("Insufficient funds"),
    });
  });

  it("surfaces other Stripe request errors with Stripe's reason", async () => {
    const create = vi.fn().mockRejectedValue(
      Stripe.errors.StripeError.generate({
        type: "invalid_request_error",
        message: "No such destination: 'acct_1'",
      }),
    );
    const { svc } = stripeWith(10_000, create);
    await expect(svc.executeTransfer(input)).rejects.toMatchObject({
      status: 400,
      message: "Stripe rejected the transfer: No such destination: 'acct_1'",
    });
  });

  it("maps Stripe outages to a 503", async () => {
    const create = vi.fn().mockRejectedValue(
      Stripe.errors.StripeError.generate({ type: "api_error", message: "boom" }),
    );
    const { svc } = stripeWith(10_000, create);
    await expect(svc.executeTransfer(input)).rejects.toMatchObject({ status: 503 });
  });
});
