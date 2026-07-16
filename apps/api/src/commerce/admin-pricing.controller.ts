import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  PatchRegionSchema,
  PatchTierSchema,
  UpsertTierSchema,
  type PatchRegionInput,
  type PatchTierInput,
  type UpsertTierInput,
} from "@skillstream/shared";
import { Roles } from "../common/decorators";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
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
    @Body(new ZodValidationPipe(UpsertTierSchema)) body: UpsertTierInput,
  ) {
    return this.pricing.createTier(body);
  }

  @Patch("tiers/:id")
  updateTier(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(PatchTierSchema)) body: PatchTierInput,
  ) {
    return this.pricing.updateTier(id, body);
  }

  @Delete("tiers/:id")
  deleteTier(@Param("id") id: string) {
    return this.pricing.deleteTier(id);
  }

  @Patch("regions/:code")
  updateRegion(
    @Param("code") code: string,
    @Body(new ZodValidationPipe(PatchRegionSchema)) body: PatchRegionInput,
  ) {
    return this.pricing.updateRegion(code, body);
  }
}
