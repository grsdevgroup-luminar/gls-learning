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
      campaignCode: row.campaignCode,
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

  /** Removing the last item drops the coupon/campaign too — otherwise it
   *  silently reapplies to whatever gets added to the cart next. */
  async removeItem(userId: string, courseId: string): Promise<CartDto> {
    const cart = await this.ensure(userId);
    await this.prisma.$transaction(async (tx) => {
      await this.repo.removeItem(cart.id, courseId, tx);
      const remaining = await this.repo.findByUserId(userId, tx);
      if (remaining?.couponCode && remaining.items.length === 0) {
        await this.repo.setCoupon(cart.id, null, tx);
      }
      if (remaining?.campaignCode && remaining.items.length === 0) {
        await this.repo.setCampaign(cart.id, null, tx);
      }
    });
    return this.toDto((await this.repo.findByUserId(userId))!);
  }

  async clear(userId: string): Promise<CartDto> {
    const cart = await this.ensure(userId);
    await this.prisma.$transaction(async (tx) => {
      await this.repo.clearItems(cart.id, tx);
      await this.repo.setCoupon(cart.id, null, tx);
      await this.repo.setCampaign(cart.id, null, tx);
    });
    return this.toDto((await this.repo.findByUserId(userId))!);
  }

  /** Mutually exclusive with the campaign code — applying a coupon clears
   *  whatever campaign code was set, enforced here so the two can never both
   *  be present regardless of what the client sends. */
  async setCoupon(
    userId: string,
    couponCode: string | null,
  ): Promise<CartDto> {
    const cart = await this.ensure(userId);
    const normalized = couponCode?.trim().toUpperCase() || null;
    await this.prisma.$transaction(async (tx) => {
      await this.repo.setCoupon(cart.id, normalized, tx);
      if (normalized) await this.repo.setCampaign(cart.id, null, tx);
    });
    return this.toDto((await this.repo.findByUserId(userId))!);
  }

  /** Mirrors setCoupon — mutually exclusive with it. */
  async setCampaign(
    userId: string,
    campaignCode: string | null,
  ): Promise<CartDto> {
    const cart = await this.ensure(userId);
    const normalized = campaignCode?.trim().toUpperCase() || null;
    await this.prisma.$transaction(async (tx) => {
      await this.repo.setCampaign(cart.id, normalized, tx);
      if (normalized) await this.repo.setCoupon(cart.id, null, tx);
    });
    return this.toDto((await this.repo.findByUserId(userId))!);
  }

  /**
   * Merges a guest cart (from localStorage) into the user's DB cart on login.
   * Union of course IDs; the server-side coupon/campaign wins unless empty,
   * in which case the guest-provided one is adopted. Idempotent — safe to
   * call twice. A guest could in principle have set both client-side (e.g.
   * two browser tabs) — coupon wins arbitrarily but deterministically if so,
   * same "first field wins" tie-break as the rest of this mutual-exclusivity
   * logic.
   */
  async merge(userId: string, input: MergeCartInput): Promise<CartDto> {
    await this.prisma.$transaction(async (tx) => {
      const cart = await this.ensure(userId, tx);
      for (const courseId of input.courseIds) {
        await this.repo.addItem(cart.id, courseId, tx);
      }
      const hasItems = cart.items.length > 0 || input.courseIds.length > 0;
      if (!cart.couponCode && !cart.campaignCode && hasItems) {
        if (input.couponCode) {
          await this.repo.setCoupon(cart.id, input.couponCode.trim().toUpperCase() || null, tx);
        } else if (input.campaignCode) {
          await this.repo.setCampaign(cart.id, input.campaignCode.trim().toUpperCase() || null, tx);
        }
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
