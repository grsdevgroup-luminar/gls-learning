import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/decorators";
import { PricingService } from "./pricing.service";

@ApiTags("pricing")
@Controller("pricing")
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Public()
  @Get("regions")
  regions() {
    return this.pricing.getRegions();
  }
}
