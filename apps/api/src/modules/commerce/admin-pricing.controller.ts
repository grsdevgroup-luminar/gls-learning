import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CreateRegionSchema,
  PatchRegionSchema,
  PatchTierSchema,
  UpsertTierSchema,
  type CreateRegionInput,
  type PatchRegionInput,
  type PatchTierInput,
  type UpsertTierInput,
} from "@skillstream/shared";
import { Roles } from "../../common/decorators/decorators";
import { ZodBody } from "../../common/utils/swagger";
import { AdminPricingService } from "./admin-pricing.service";

@ApiTags("admin-pricing")
@ApiBearerAuth()
@Roles("ADMIN")
@Controller("admin/pricing")
export class AdminPricingController {
  constructor(private readonly pricing: AdminPricingService) {}

  @Get()
  getAll() {
    return this.pricing.getAll();
  }

  @Post("tiers")
  createTier(
    @ZodBody(UpsertTierSchema) body: UpsertTierInput,
  ) {
    return this.pricing.createTier(body);
  }

  @Patch("tiers/:id")
  updateTier(
    @Param("id") id: string,
    @ZodBody(PatchTierSchema) body: PatchTierInput,
  ) {
    return this.pricing.updateTier(id, body);
  }

  @Delete("tiers/:id")
  deleteTier(@Param("id") id: string) {
    return this.pricing.deleteTier(id);
  }

  @Post("regions")
  createRegion(
    @ZodBody(CreateRegionSchema) body: CreateRegionInput,
  ) {
    return this.pricing.createRegion(body);
  }

  @Patch("regions/:code")
  updateRegion(
    @Param("code") code: string,
    @ZodBody(PatchRegionSchema) body: PatchRegionInput,
  ) {
    return this.pricing.updateRegion(code, body);
  }

  @Delete("regions/:code")
  deleteRegion(@Param("code") code: string) {
    return this.pricing.deleteRegion(code);
  }
}
