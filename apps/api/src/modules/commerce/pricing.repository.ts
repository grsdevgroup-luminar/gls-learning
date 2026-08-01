import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { Db } from "../../common/types";

@Injectable()
export class PricingRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db) {
    return tx ?? this.prisma;
  }

  findAllRegions() {
    return this.prisma.region.findMany({ orderBy: { country: "asc" } });
  }

  findRegionByCode(code: string) {
    return this.prisma.region.findUnique({ where: { code } });
  }

  findAllTiersAndRegions() {
    return this.prisma.$transaction([
      this.prisma.pricingTier.findMany({ orderBy: { multiplier: "desc" } }),
      this.prisma.region.findMany({ orderBy: { country: "asc" } }),
    ]);
  }

  createTier(data: Prisma.PricingTierCreateInput, tx?: Db) {
    return this.db(tx).pricingTier.create({ data });
  }

  findTierById(id: string) {
    return this.prisma.pricingTier.findUnique({ where: { id } });
  }

  updateTier(id: string, data: Prisma.PricingTierUpdateInput, tx?: Db) {
    return this.db(tx).pricingTier.update({ where: { id }, data });
  }

  updateRegionsMultiplierForTier(tierId: string, multiplier: number, tx?: Db) {
    return this.db(tx).region.updateMany({
      where: { tierId, override: false },
      data: { multiplier },
    });
  }

  countRegionsByTier(tierId: string) {
    return this.prisma.region.count({ where: { tierId } });
  }

  deleteTier(id: string, tx?: Db) {
    return this.db(tx).pricingTier.delete({ where: { id } });
  }

  updateRegion(
    code: string,
    data: Prisma.RegionUpdateInput | Prisma.RegionUncheckedUpdateInput,
    tx?: Db,
  ) {
    return this.db(tx).region.update({ where: { code }, data });
  }
}
