import { Injectable } from "@nestjs/common";
import type { CartDto, MergeCartInput } from "@skillstream/shared";
import { PrismaService } from "../../prisma/prisma.service";
import type { Db } from "../../common/types";
import { CartRepository, type CartRow } from "./cart.repository";

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: CartRepository,
  ) {}

  private toDto(row: CartRow): CartDto {
    return {
      items: row.items.map((i) => ({
        courseId: i.courseId,
        addedAt: i.createdAt.toISOString(),
      })),
      couponCode: row.couponCode,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async ensure(userId: string, tx?: Db): Promise<CartRow> {
    const existing = await this.repo.findByUserId(userId, tx);
    if (existing) return existing;
    return this.repo.createEmpty(userId, tx);
  }

  async get(userId: string): Promise<CartDto> {
    return this.toDto(await this.ensure(userId));
  }

  async addItem(userId: string, courseId: string): Promise<CartDto> {
    const cart = await this.ensure(userId);
    await this.repo.addItem(cart.id, courseId);
    return this.toDto((await this.repo.findByUserId(userId))!);
  }

  async removeItem(userId: string, courseId: string): Promise<CartDto> {
    const cart = await this.ensure(userId);
    await this.repo.removeItem(cart.id, courseId);
    return this.toDto((await this.repo.findByUserId(userId))!);
  }

  async clear(userId: string): Promise<CartDto> {
    const cart = await this.ensure(userId);
    await this.prisma.$transaction(async (tx) => {
      await this.repo.clearItems(cart.id, tx);
      await this.repo.setCoupon(cart.id, null, tx);
    });
    return this.toDto((await this.repo.findByUserId(userId))!);
  }

  async setCoupon(
    userId: string,
    couponCode: string | null,
  ): Promise<CartDto> {
    const cart = await this.ensure(userId);
    const normalized = couponCode?.trim().toUpperCase() || null;
    await this.repo.setCoupon(cart.id, normalized);
    return this.toDto((await this.repo.findByUserId(userId))!);
  }

  /**
   * Merges a guest cart (from localStorage) into the user's DB cart on login.
   * Union of course IDs; the server-side coupon wins unless empty, in which
   * case the guest-provided one is adopted. Idempotent — safe to call twice.
   */
  async merge(userId: string, input: MergeCartInput): Promise<CartDto> {
    await this.prisma.$transaction(async (tx) => {
      const cart = await this.ensure(userId, tx);
      for (const courseId of input.courseIds) {
        await this.repo.addItem(cart.id, courseId, tx);
      }
      if (!cart.couponCode && input.couponCode) {
        await this.repo.setCoupon(
          cart.id,
          input.couponCode.trim().toUpperCase() || null,
          tx,
        );
      }
    });
    return this.toDto((await this.repo.findByUserId(userId))!);
  }

  /** Fired from OrdersService.fulfill — wipes items + coupon post-purchase. */
  async resetOnFulfilled(userId: string, tx?: Db): Promise<void> {
    const existing = await this.repo.findByUserId(userId, tx);
    if (!existing) return;
    await this.repo.reset(userId, tx);
  }
}
