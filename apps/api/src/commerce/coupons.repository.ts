import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class CouponsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db) {
    return tx ?? this.prisma;
  }

  findByCode(code: string, tx?: Db) {
    return this.db(tx).coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
  }

  findFeatured() {
    return this.prisma.coupon.findFirst({ where: { featured: true } });
  }
}
