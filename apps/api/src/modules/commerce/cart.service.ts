import { Injectable } from "@nestjs/common";
import type { CartDto, MergeCartInput } from "@grslearning/shared";
import { PrismaService } from "../../prisma/prisma.service";
import type { Db } from "../../common/types";
import { CartRepository, type CartRow } from "./cart.repository";
import { CodeResolverService } from "./code-resolver.service";

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: CartRepository,
    private readonly codeResolver: CodeResolverService,
  ) {}

  private toDto(row: CartRow): CartDto {
    return {
      items: row.items.map((i) => ({
        courseId: i.courseId,
        addedAt: i.createdAt.toISOString(),
      })),
      code: row.couponCode ?? row.campaignCode,
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

  /** One code field — resolves whether it's a Coupon or a
   *  DeliveryPartnerCampaign code (see CodeResolverService) and writes it to
   *  the matching cart column, clearing the other so the two stay mutually
   *  exclusive regardless of what the client sends. An unresolved code is
   *  stored as a coupon code anyway, so it still round-trips through the
   *  existing "coupon not found" error at quote time instead of needing a
   *  third state here. */
  async setCode(userId: string, code: string | null): Promise<CartDto> {
    const cart = await this.ensure(userId);
    const normalized = code?.trim().toUpperCase() || null;
    await this.prisma.$transaction(async (tx) => {
      if (!normalized) {
        await this.repo.setCoupon(cart.id, null, tx);
        await this.repo.setCampaign(cart.id, null, tx);
        return;
      }
      const type = await this.codeResolver.resolveType(normalized, tx);
      if (type === "campaign") {
        await this.repo.setCampaign(cart.id, normalized, tx);
        await this.repo.setCoupon(cart.id, null, tx);
      } else {
        await this.repo.setCoupon(cart.id, normalized, tx);
        await this.repo.setCampaign(cart.id, null, tx);
      }
    });
    return this.toDto((await this.repo.findByUserId(userId))!);
  }

  /**
   * Merges a guest cart (from localStorage) into the user's DB cart on login.
   * Union of course IDs; the server-side code wins unless empty, in which
   * case the guest-provided one is adopted (type resolved the same way
   * setCode does). Idempotent — safe to call twice.
   */
  async merge(userId: string, input: MergeCartInput): Promise<CartDto> {
    await this.prisma.$transaction(async (tx) => {
      const cart = await this.ensure(userId, tx);
      for (const courseId of input.courseIds) {
        await this.repo.addItem(cart.id, courseId, tx);
      }
      const hasItems = cart.items.length > 0 || input.courseIds.length > 0;
      const guestCode = input.code?.trim().toUpperCase() || null;
      if (!cart.couponCode && !cart.campaignCode && hasItems && guestCode) {
        const type = await this.codeResolver.resolveType(guestCode, tx);
        if (type === "campaign") await this.repo.setCampaign(cart.id, guestCode, tx);
        else await this.repo.setCoupon(cart.id, guestCode, tx);
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
