import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  paginationQuerySchema,
  type PaginationQuery,
} from "@skillstream/shared";
import { CurrentUser, type RequestUser } from "../../common/decorators/decorators";
import { ZodQuery } from "../../common/utils/swagger";
import { CreditsService } from "./credits.service";

@ApiTags("credits")
@ApiBearerAuth()
@Controller("me/credits")
export class CreditsController {
  constructor(private readonly credits: CreditsService) {}

  @Get()
  @ApiOperation({ summary: "Available store credit balances for the caller, grouped by currency" })
  balances(@CurrentUser() user: RequestUser) {
    return this.credits.getBalancesForUser(user.id);
  }

  @Get("history")
  @ApiOperation({ summary: "Paginated credit ledger (grants + spends), newest first" })
  history(
    @CurrentUser() user: RequestUser,
    @ZodQuery(paginationQuerySchema) query: PaginationQuery,
  ) {
    return this.credits.getHistoryForUser(user.id, query);
  }
}
