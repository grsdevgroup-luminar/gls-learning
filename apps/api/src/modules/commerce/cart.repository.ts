import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { Db } from "../../common/types";

export const cartInclude = {
  items: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.CartInclude;

export type CartRow = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

@Injectable()
export class CartRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db) {
    return tx ?? this.prisma;
  }

  findByUserId(userId: string, tx?: Db): Promise<CartRow | null> {
    return this.db(tx).cart.findUnique({
      where: { userId },
      include: cartInclude,
    });
  }

  createEmpty(userId: string, tx?: Db): Promise<CartRow> {
    return this.db(tx).cart.create({
      data: { userId },
      include: cartInclude,
    });
  }

  /** Idempotent — @@unique([cartId, courseId]) makes duplicate add a no-op. */
  addItem(cartId: string, courseId: string, tx?: Db) {
    return this.db(tx).cartItem.upsert({
      where: { cartId_courseId: { cartId, courseId } },
      create: { cartId, courseId },
      update: {},
    });
  }

  removeItem(cartId: string, courseId: string, tx?: Db) {
    return this.db(tx).cartItem.deleteMany({ where: { cartId, courseId } });
  }

  clearItems(cartId: string, tx?: Db) {
    return this.db(tx).cartItem.deleteMany({ where: { cartId } });
  }

  setCoupon(cartId: string, couponCode: string | null, tx?: Db) {
    return this.db(tx).cart.update({
      where: { id: cartId },
      data: { couponCode },
      include: cartInclude,
    });
  }

  /** Called after checkout success — wipes items + coupon but keeps the row. */
  reset(userId: string, tx?: Db) {
    return this.db(tx).cart.update({
      where: { userId },
      data: { couponCode: null, items: { deleteMany: {} } },
    });
  }
}
