import { Injectable } from "@nestjs/common";
import type { CreditLedgerReason } from "@prisma/client";
import type { Db } from "../../common/types";
import { PrismaService } from "../../prisma/prisma.service";

export interface CreateLedgerEntry {
  userId: string;
  amountCents: number;
  currency: string;
  reason: CreditLedgerReason;
  orderId?: string | null;
  adminUserId?: string | null;
  comment?: string | null;
}

@Injectable()
export class CreditsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db): Db {
    return tx ?? this.prisma;
  }

  createEntry(data: CreateLedgerEntry, tx?: Db) {
    return this.db(tx).studentCreditLedger.create({ data });
  }

  /** Balance for a single (userId, currency). SUM over all signed rows —
   *  positive grants + negative spends net to the current balance. */
  async getBalance(userId: string, currency: string, tx?: Db): Promise<number> {
    const rows = await this.db(tx).studentCreditLedger.aggregate({
      where: { userId, currency },
      _sum: { amountCents: true },
    });
    return rows._sum.amountCents ?? 0;
  }

  /** Balances grouped by currency — a user could accrue credit in multiple
   *  currencies over time as orders in different regions get refunded. */
  async getBalancesByCurrency(
    userId: string,
    tx?: Db,
  ): Promise<{ currency: string; amountCents: number }[]> {
    const rows = await this.db(tx).studentCreditLedger.groupBy({
      by: ["currency"],
      where: { userId },
      _sum: { amountCents: true },
    });
    return rows
      .map((r) => ({ currency: r.currency, amountCents: r._sum.amountCents ?? 0 }))
      .filter((r) => r.amountCents !== 0);
  }

  findPageByUser(userId: string, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    return Promise.all([
      this.prisma.studentCreditLedger.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.studentCreditLedger.count({ where: { userId } }),
    ]);
  }
}
