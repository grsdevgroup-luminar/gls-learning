import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  AdminPricingDto,
  AdminRegionDto,
  AdminTierDto,
  PatchRegionInput,
  PatchTierInput,
  UpsertTierInput,
} from "@skillstream/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminPricingService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<AdminPricingDto> {
    const [tiers, regions] = await this.prisma.$transaction([
      this.prisma.pricingTier.findMany({ orderBy: { multiplier: "desc" } }),
      this.prisma.region.findMany({ orderBy: { country: "asc" } }),
    ]);
    return {
      tiers: tiers.map((t): AdminTierDto => ({
        id: t.id,
        name: t.name,
        multiplier: t.multiplier,
        // Regions are the source of truth for membership; derive the list.
        countries: regions
          .filter((r) => r.tierId === t.id)
          .map((r) => r.country),
      })),
      regions: regions.map(
        (r): AdminRegionDto => ({
          code: r.code,
          country: r.country,
          flag: r.flag,
          currency: r.currency,
          symbol: r.symbol,
          locale: r.locale,
          fxRate: r.fxRate,
          multiplier: r.multiplier,
          tierId: r.tierId,
          override: r.override,
        }),
      ),
    };
  }

  async createTier(input: UpsertTierInput): Promise<AdminPricingDto> {
    await this.prisma.pricingTier.create({
      data: {
        id: `tier_${randomUUID().slice(0, 8)}`,
        name: input.name,
        multiplier: input.multiplier,
        countries: [],
      },
    });
    return this.getAll();
  }

  async updateTier(id: string, input: PatchTierInput): Promise<AdminPricingDto> {
    const tier = await this.prisma.pricingTier.findUnique({ where: { id } });
    if (!tier) throw new NotFoundException("Tier not found");
    await this.prisma.pricingTier.update({
      where: { id },
      data: { name: input.name, multiplier: input.multiplier },
    });
    // A tier's multiplier is inherited by its non-overridden regions — keep
    // them in sync so checkout prices reflect the edit immediately.
    if (input.multiplier !== undefined && input.multiplier !== tier.multiplier) {
      await this.prisma.region.updateMany({
        where: { tierId: id, override: false },
        data: { multiplier: input.multiplier },
      });
    }
    return this.getAll();
  }

  async deleteTier(id: string): Promise<AdminPricingDto> {
    const inUse = await this.prisma.region.count({ where: { tierId: id } });
    if (inUse > 0)
      throw new BadRequestException(
        `Reassign the ${inUse} country(ies) in this tier before deleting it`,
      );
    await this.prisma.pricingTier.delete({ where: { id } }).catch(() => {
      throw new NotFoundException("Tier not found");
    });
    return this.getAll();
  }

  async updateRegion(
    code: string,
    input: PatchRegionInput,
  ): Promise<AdminPricingDto> {
    const region = await this.prisma.region.findUnique({ where: { code } });
    if (!region) throw new NotFoundException("Region not found");

    const nextTierId = input.tierId ?? region.tierId;
    // Setting a multiplier implies a custom override; explicit override:false clears it.
    const override =
      input.multiplier !== undefined
        ? true
        : (input.override ?? region.override);

    let multiplier = region.multiplier;
    if (override && input.multiplier !== undefined) {
      multiplier = input.multiplier;
    } else if (!override) {
      // Inherit from the (possibly newly assigned) tier.
      const tier = nextTierId
        ? await this.prisma.pricingTier.findUnique({ where: { id: nextTierId } })
        : null;
      if (nextTierId && !tier)
        throw new BadRequestException("Assigned tier does not exist");
      multiplier = tier?.multiplier ?? region.multiplier;
    }

    await this.prisma.region.update({
      where: { code },
      data: {
        tierId: nextTierId,
        override,
        multiplier,
        fxRate: input.fxRate,
        currency: input.currency,
        symbol: input.symbol,
      },
    });
    return this.getAll();
  }
}
