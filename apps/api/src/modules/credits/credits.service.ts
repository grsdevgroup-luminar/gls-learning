import { BadRequestException, Injectable } from "@nestjs/common";
import type { CreditBalanceDto, CreditLedgerEntryDto, Paginated, PaginationQuery } from "@skillstream/shared";
import type { Db } from "../../common/types";
import { CreditsRepository } from "./credits.repository";

@Injectable()
export class CreditsService {
  constructor(private readonly repo: CreditsRepository) {}

  /** Grants credit from an admin refund. Positive signed row. */
  grantRefund(
    input: {
      userId: string;
      amountCents: number;
      currency: string;
      orderId: string;
      adminUserId: string;
      comment: string;
    },
    tx?: Db,
  ) {
    if (input.amountCents <= 0)
      throw new BadRequestException("Grant amount must be positive");
    return this.repo.createEntry(
      {
        userId: input.userId,
        amountCents: input.amountCents,
        currency: input.currency,
        reason: "GRANT_REFUND",
        orderId: input.orderId,
        adminUserId: input.adminUserId,
        comment: input.comment,
      },
      tx,
    );
  }

  /** Records credit spent at checkout. Negative signed row. */
  spendAtCheckout(
    input: {
      userId: string;
      amountCents: number; // positive input; we store as negative
      currency: string;
      orderId: string;
    },
    tx?: Db,
  ) {
    if (input.amountCents <= 0)
      throw new BadRequestException("Spend amount must be positive");
    return this.repo.createEntry(
      {
        userId: input.userId,
        amountCents: -input.amountCents,
        currency: input.currency,
        reason: "SPEND_CHECKOUT",
        orderId: input.orderId,
      },
      tx,
    );
  }

  getBalance(userId: string, currency: string, tx?: Db) {
    return this.repo.getBalance(userId, currency, tx);
  }

  async getBalancesForUser(userId: string): Promise<CreditBalanceDto[]> {
    const rows = await this.repo.getBalancesByCurrency(userId);
    return rows.map((r) => ({ currency: r.currency, amountCents: r.amountCents }));
  }

  async getHistoryForUser(
    userId: string,
    query: PaginationQuery,
  ): Promise<Paginated<CreditLedgerEntryDto>> {
    const [rows, total] = await this.repo.findPageByUser(
      userId,
      query.page,
      query.pageSize,
    );
    return {
      items: rows.map(
        (r): CreditLedgerEntryDto => ({
          id: r.id,
          amountCents: r.amountCents,
          currency: r.currency,
          reason: r.reason,
          orderId: r.orderId,
          comment: r.comment,
          createdAt: r.createdAt.toISOString(),
        }),
      ),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }
}
