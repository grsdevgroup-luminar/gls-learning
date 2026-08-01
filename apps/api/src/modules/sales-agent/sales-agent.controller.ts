import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SalesAgentStatus } from "@prisma/client";
import {
  ApplySalesAgentSchema,
  ReviewAgentApplicationSchema,
  UpdateAgentSchema,
  type ApplySalesAgentInput,
  type ReviewAgentApplicationInput,
  type UpdateAgentInput,
} from "@skillstream/shared";
import { CurrentUser, Roles, type RequestUser } from "../../common/decorators/decorators";
import { ZodBody } from "../../common/utils/swagger";
import { SalesAgentService } from "./sales-agent.service";

@ApiTags("sales-agent")
@ApiBearerAuth()
@Controller()
export class SalesAgentController {
  constructor(private readonly agents: SalesAgentService) {}

  @Post("sales-agents/apply")
  apply(
    @CurrentUser() user: RequestUser,
    @ZodBody(ApplySalesAgentSchema) body: ApplySalesAgentInput,
  ) {
    return this.agents.apply(user, body);
  }

  @Get("me/sales-agent")
  me(@CurrentUser() user: RequestUser) {
    return this.agents.me(user);
  }

  @Get("me/sales-agent/referrals")
  myReferrals(@CurrentUser() user: RequestUser) {
    return this.agents.myReferrals(user);
  }

  // ── admin ──
  @Roles("ADMIN")
  @Get("admin/sales-agent-applications")
  listApplications(@Query("status") status?: SalesAgentStatus) {
    return this.agents.listApplications(status);
  }

  @Roles("ADMIN")
  @Post("admin/sales-agent-applications/:id/review")
  review(
    @Param("id") id: string,
    @ZodBody(ReviewAgentApplicationSchema)
    body: ReviewAgentApplicationInput,
  ) {
    return this.agents.reviewApplication(id, body);
  }

  @Roles("ADMIN")
  @Get("admin/sales-agents")
  listAgents() {
    return this.agents.listAgents();
  }

  @Roles("ADMIN")
  @Patch("admin/sales-agents/:id")
  updateAgent(
    @Param("id") id: string,
    @ZodBody(UpdateAgentSchema) body: UpdateAgentInput,
  ) {
    return this.agents.updateAgent(id, body);
  }
}
