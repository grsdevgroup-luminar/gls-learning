import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FxRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllRegions() {
    return this.prisma.region.findMany({
      select: { code: true, currency: true, fxRate: true },
    });
  }

  updateRegionRate(code: string, fxRate: number, fxUpdatedAt: Date) {
    return this.prisma.region.update({
      where: { code },
      data: { fxRate, fxUpdatedAt },
    });
  }
}
